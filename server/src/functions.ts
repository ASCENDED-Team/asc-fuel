import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { useApi } from '@Server/api/index.js';
import { FUEL_SETTINGS, getVehicleConsumption } from './config.js';

const Rebar = useRebar();
const API = useApi();

interface VehicleFuelData {
    position: alt.Vector3;
    fuel: number;
    timestamp: number;
}

const vehicleFuelData = new Map<number, VehicleFuelData>();
const engineBreakdownTimers = new Set<number>();

function handleError(error: Error, context: string) {
    console.error(`[Ascended Fuel] Error in ${context}:`, error);
}

/**
 * Creates Ascended Fuel properties on a vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle to modify.
 */
export async function createAscendedFuelPropertie(vehicle: alt.Vehicle) {
    try {
        const vehicleDocument = Rebar.document.vehicle.useVehicle(vehicle);
        const modelName = Rebar.utility.vehicleHashes.getNameFromHash(vehicle.model).toLowerCase();
        const { consume, maxFuel, type } = getVehicleConsumption(modelName);

        if (vehicleDocument.get().ascendedFuel) return;

        await vehicleDocument.setBulk({
            fuel: maxFuel,
            ascendedFuel: {
                consumption: consume,
                max: maxFuel,
                type: type || FUEL_SETTINGS.DefaultFuel,
                typeTanked: type || FUEL_SETTINGS.DefaultFuel,
            },
        });

        console.log(
            `Added ascended fuel properties for Vehicle Model: ${modelName} | Fuel: ${vehicleDocument.getField('fuel')}`,
        );
    } catch (error) {
        handleError(error, `createAscendedFuelPropertie for model ${vehicle.model}`);
    }
}

/**
 * Starts tracking fuel consumption for a player's vehicle.
 * @param {alt.Player} player - The player whose vehicle to track.
 */
export function startTracking(player: alt.Player) {
    const vehicle = player.vehicle;
    if (!vehicle) return;

    const rebarDocument = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!rebarDocument) return;

    vehicleFuelData.set(vehicle.id, {
        position: vehicle.pos,
        fuel: rebarDocument.fuel,
        timestamp: Date.now(),
    });
}

/**
 * Updates the fuel consumption for a player's vehicle.
 * @param {alt.Player} player - The player whose vehicle fuel to update.
 */
export async function updateFuelConsumption(player: alt.Player): Promise<void> {
    try {
        const vehicle = player.vehicle;
        if (!vehicle) return;

        const currentData = vehicleFuelData.get(vehicle.id);
        if (!currentData) return;

        const distanceTraveled = calculateDistanceTraveled(vehicle, currentData.position);
        const timeElapsed = (Date.now() - currentData.timestamp) / 1000;

        if (distanceTraveled <= 0 || timeElapsed <= 0) return;

        const speed = distanceTraveled / timeElapsed;
        const fuelConsumed = await calculateFuelConsumed(vehicle, distanceTraveled, speed);
        const remainingFuel = Math.max(0, currentData.fuel - fuelConsumed);

        await updateVehicleFuel(vehicle, remainingFuel);
        updateVehicleData(vehicle, vehicle.pos, remainingFuel, Date.now());

        if (remainingFuel <= 0 && vehicle.engineOn) {
            await handleOutOfFuel(player, vehicle);
        }

        await checkFuelTypeMismatch(player, vehicle);
    } catch (error) {
        handleError(error, 'updateFuelConsumption');
    }
}

/**
 * Calculates the distance traveled by a vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle.
 * @param {alt.Vector3} lastPosition - The last recorded position of the vehicle.
 * @returns {number} The distance traveled in meters.
 */
function calculateDistanceTraveled(vehicle: alt.Vehicle, lastPosition: alt.Vector3): number {
    return Rebar.utility.vector.distance(vehicle.pos, lastPosition);
}

/**
 * Calculates the fuel consumed by a vehicle based on distance and speed.
 * @param {alt.Vehicle} vehicle - The vehicle.
 * @param {number} distance - The distance traveled in meters.
 * @param {number} speed - The speed of the vehicle in meters per second.
 * @returns {Promise<number>} The amount of fuel consumed.
 */
async function calculateFuelConsumed(vehicle: alt.Vehicle, distance: number, speed: number): Promise<number> {
    const baseConsumptionRate = await getVehicleFuelConsumption(vehicle);
    const adjustedConsumptionRate = baseConsumptionRate * (1 + speed / 100);
    return distance * adjustedConsumptionRate;
}

/**
 * Handles the vehicle running out of fuel.
 * @param {alt.Player} player - The player driving the vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle.
 */
async function handleOutOfFuel(player: alt.Player, vehicle: alt.Vehicle) {
    await toggleEngineWithoutPlayer(vehicle);

    if (FUEL_SETTINGS.AscNotification) {
        const NotificationAPI = await API.getAsync('ascended-notification-api');
        NotificationAPI.general.send(player, {
            icon: '⛽',
            title: 'Out of Fuel',
            message: 'Your vehicle has run out of fuel.',
            duration: 5000,
        });
    }

    await updateVehicleFuel(vehicle, 0);
    updateVehicleData(vehicle, vehicle.pos, 0, Date.now());
}

/**
 * Updates the fuel level of a vehicle in its document.
 * @param {alt.Vehicle} vehicle - The vehicle.
 * @param {number} fuel - The new fuel level.
 */
async function updateVehicleFuel(vehicle: alt.Vehicle, fuel: number) {
    await Rebar.document.vehicle.useVehicle(vehicle).set('fuel', parseFloat(fuel.toFixed(2)));
}

/**
 * Updates the vehicle data in the `vehicleFuelData` map.
 * @param {alt.Vehicle} vehicle - The vehicle.
 * @param {alt.Vector3} position - The current position of the vehicle.
 * @param {number} fuel - The current fuel level.
 * @param {number} timestamp - The current timestamp.
 */
function updateVehicleData(vehicle: alt.Vehicle, position: alt.Vector3, fuel: number, timestamp: number) {
    vehicleFuelData.set(vehicle.id, { position, fuel, timestamp });
}

/**
 * Checks for fuel type mismatch and handles engine breakdown.
 * @param {alt.Player} player - The player driving the vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle.
 */
async function checkFuelTypeMismatch(player: alt.Player, vehicle: alt.Vehicle) {
    const ascendedFuel = await getAscendedFuel(vehicle);

    if (ascendedFuel && ascendedFuel.typeTanked !== ascendedFuel.type) {
        if (!engineBreakdownTimers.has(vehicle.id)) {
            engineBreakdownTimers.add(vehicle.id);

            const interval = alt.setInterval(async () => {
                const currentHealth = vehicle.engineHealth;
                const newHealth = Math.max(0, currentHealth - 25);

                vehicle.engineHealth = newHealth;

                if (newHealth <= 0) {
                    alt.clearInterval(interval);
                    await breakEngine(player, vehicle);
                    engineBreakdownTimers.delete(vehicle.id);
                }
            }, 1000);
        }
    } else {
        if (vehicle.engineHealth < 1000) {
            vehicle.engineHealth = Math.min(vehicle.engineHealth + 1, 1000);
        }
    }
}

/**
 * Repairs the fuel type mismatch in a vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle to repair.
 */
export async function repairFuelTypeMismatch(vehicle: alt.Vehicle) {
    const vehicleDoc = Rebar.document.vehicle.useVehicle(vehicle);
    const document = vehicleDoc.get();

    if (!document || !document.ascendedFuel) return;

    document.ascendedFuel.typeTanked = document.ascendedFuel.type;
    await vehicleDoc.set('ascendedFuel', document.ascendedFuel);

    // Optionally: You can add logic here to:
    // - Charge the mechanic a repair fee
    // - Play a repair animation/sound
    // - Notify the mechanic that the repair is complete

    console.log(`Fuel type mismatch repaired for vehicle ${vehicle.id}`);
}

/**
 * Toggles the engine of a vehicle for a player.
 * @param {alt.Player} player - The player attempting to toggle the engine.
 */
export async function toggleEngine(player: alt.Player) {
    const vehicle = player.vehicle;
    if (!vehicle || player.seat !== 1) return;

    const rebarVehicle = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!rebarVehicle || !rebarVehicle.ascendedFuel) {
        Rebar.vehicle.useVehicle(vehicle).toggleEngine();
        return;
    }

    if (vehicle.hasStreamSyncedMeta('engineIsDisabled') && vehicle.getStreamSyncedMeta('engineIsDisabled')) {
        return;
    }

    const fuel = rebarVehicle.fuel;

    if (!vehicle.engineOn && fuel <= 0) {
        if (FUEL_SETTINGS.AscNotification) {
            const NotificationAPI = await API.getAsync('ascended-notification-api');
            NotificationAPI.general.send(player, {
                title: 'Out of Fuel',
                icon: '⛽',
                message: 'Your vehicle has run out of fuel.',
                duration: 5000,
            });
        }
        return;
    }

    if (FUEL_SETTINGS.enableSound) {
        Rebar.player.useAudio(player).playSound(`/sounds/engine.ogg`);
    }

    for (const _player of Object.values(vehicle.passengers)) {
        alt.emitClient(_player, 'ResetRPM');
    }

    const isOwned = Rebar.vehicle.useVehicle(vehicle).verifyOwner(player, false, false);
    if (isOwned) {
        Rebar.vehicle.useVehicle(vehicle).toggleEngine();
    } else {
        if (FUEL_SETTINGS.AscNotification) {
            const NotificationAPI = await API.getAsync('ascended-notification-api');
            NotificationAPI.general.send(player, {
                title: 'Not Your Vehicle',
                icon: '❌',
                message: 'You do not own this vehicle.',
                duration: 5000,
            });
        }
    }
}

/**
 * Stops tracking fuel consumption for a vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle to stop tracking.
 */
export function stopTracking(vehicle: alt.Vehicle) {
    vehicleFuelData.delete(vehicle.id);
}

/**
 * Toggles the engine of a vehicle without a player directly interacting with it.
 * @param {alt.Vehicle} vehicle - The vehicle.
 */
export async function toggleEngineWithoutPlayer(vehicle: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!rebarVehicle || !rebarVehicle.ascendedFuel) {
        Rebar.vehicle.useVehicle(vehicle).toggleEngine();
        return;
    }

    const fuel = rebarVehicle.fuel;

    if (!vehicle.engineOn) {
        if (fuel <= 0) {
            alt.logWarning('Vehicle has no fuel');
            return;
        }

        if (vehicle.hasStreamSyncedMeta('engineIsDisabled') && vehicle.getStreamSyncedMeta('engineIsDisabled')) {
            return;
        }
    } else {
        for (const _player of Object.values(vehicle.passengers)) {
            alt.emitClient(_player, 'ResetRPM');
        }
    }

    Rebar.vehicle.useVehicle(vehicle).toggleEngine();
}

/**
 * Breaks the engine of a vehicle due to fuel type mismatch.
 * @param {alt.Player} player - The player driving the vehicle.
 * @param {alt.Vehicle} vehicle - The vehicle.
 */
async function breakEngine(player: alt.Player, vehicle: alt.Vehicle) {
    await toggleEngineWithoutPlayer(vehicle);

    if (FUEL_SETTINGS.AscNotification) {
        const ascendedFuel = await getAscendedFuel(vehicle);
        if (ascendedFuel) {
            const NotificationAPI = await API.getAsync('ascended-notification-api');
            NotificationAPI.general.send(player, {
                title: 'Fuel Type Mismatch',
                icon: '⛽',
                message: `Your vehicle engine has broken down due to fuel type mismatch. You've used ${ascendedFuel.typeTanked} instead of ${ascendedFuel.type}!`,
                duration: 5000,
            });
        }
    }
}

/**
 * Refills the fuel of a player's vehicle.
 * @param {alt.Player} player - The player whose vehicle to refuel.
 * @param {number} [amount] - The amount of fuel to add (defaults to filling the tank).
 */
export async function refillVehicle(player: alt.Player, amount?: number) {
    const vehicle = player.vehicle;
    if (!vehicle) return;

    const vehicleDoc = Rebar.document.vehicle.useVehicle(vehicle);
    const document = vehicleDoc.get();

    if (!document || !document.ascendedFuel) return;

    const maxFuel = document.ascendedFuel.max;
    const currentFuel = document.fuel;
    const refillAmount = amount || maxFuel - currentFuel;
    const newFuel = Math.min(currentFuel + refillAmount, maxFuel);

    await vehicleDoc.setBulk({
        fuel: parseFloat(newFuel.toFixed(2)),
        ascendedFuel: { ...document.ascendedFuel },
    });

    updateVehicleData(vehicle, vehicle.pos, newFuel, Date.now());

    if (FUEL_SETTINGS.AscNotification) {
        const NotificationAPI = await API.getAsync('ascended-notification-api');
        NotificationAPI.general.send(player, {
            title: 'Vehicle Refueled',
            icon: '⛽',
            message: `Vehicle refueled. New fuel level: ${newFuel.toFixed(2)}L`,
            duration: 5000,
        });
    }
}

/**
 * Refills the closest vehicle to a player.
 * @param {alt.Player} player - The player.
 * @param {number} amount - The amount of fuel to add.
 * @param {string} [type] - The type of fuel to add.
 * @param {number} [duration=5000] - The duration of the refuel animation in milliseconds.
 */
export async function refillClosestVehicle(
    player: alt.Player,
    amount: number,
    type?: string,
    duration: number = 5000,
): Promise<void> {
    const closeVehicle = Rebar.get.useVehicleGetter().closestVehicle(player, 5);
    if (!closeVehicle || player.vehicle) return;

    Rebar.player.useAnimation(player).playFinite('mini@repair', 'fixing_a_ped', 1, duration);

    alt.setTimeout(async () => {
        const document = Rebar.document.vehicle.useVehicle(closeVehicle);
        const vehicleDocument = document.get();
        if (!vehicleDocument || !vehicleDocument.ascendedFuel) return;

        const maxFuel = vehicleDocument.ascendedFuel.max;
        const newFuel = parseFloat(Math.min(document.getField('fuel') + amount, maxFuel).toFixed(2));

        if (type) {
            vehicleDocument.ascendedFuel.typeTanked = type;
        }

        await document.setBulk({
            fuel: newFuel,
            ascendedFuel: vehicleDocument.ascendedFuel,
        });

        updateVehicleData(closeVehicle, closeVehicle.pos, newFuel, Date.now());

        console.log(`Refueled closest vehicle - New Fuel Level: ${newFuel}L`);
    }, duration);
}

// Getter functions for various vehicle fuel properties

export async function getVehicleFuelType(veh: alt.Vehicle): Promise<string | null> {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.type || null;
}

export async function getVehicleFuelTypeTanked(veh: alt.Vehicle): Promise<string | null> {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.typeTanked || null;
}

export async function getVehicleFuelConsumption(veh: alt.Vehicle): Promise<number> {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.consumption || 0;
}

export async function getVehicleMaxFuel(veh: alt.Vehicle): Promise<number> {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.max || 0;
}

export async function getVehicleFuel(veh: alt.Vehicle): Promise<number> {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.fuel || 0;
}

export async function getAscendedFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel || null;
}
