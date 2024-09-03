import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { useApi } from '@Server/api/index.js';
import { FUEL_SETTINGS, getVehicleConsumption } from './config.js';

const Rebar = useRebar();
const API = useApi();

interface VehicleData {
    position: alt.Vector3;
    fuel: number;
    consumptionRate: number;
    timestamp: number;
}

const vehicleData = new Map<number, VehicleData>();
const timeoutSet = new Set<number>();

let NotificationAPI: Awaited<{
    create: (
        player: alt.Player,
        notification: {
            icon: string;
            title: string;
            subTitle: string;
            message: string;
            duration?: number;
            oggFile?: string;
        },
    ) => void;
    type: () => { info: string; error: string; warning: string; success: string };
}> = null;

async function initializeNotificationAPI() {
    if (FUEL_SETTINGS.AscNotification) {
        NotificationAPI = await API.getAsync('ascended-notification-api');
    }
}

initializeNotificationAPI();

function handleError(error: Error, context: string) {
    console.error(`[Ascended Fuel] Error in ${context}:`, error);
}

export async function createAscendedFuelPropertie(vehicle: alt.Vehicle) {
    try {
        const vehicleDocument = Rebar.document.vehicle.useVehicle(vehicle);
        await vehicleDocument.setBulk({
            fuel: 30,
            ascendedFuel: {
                consumption: 0,
                max: 0,
                type: '',
                typeTanked: '',
            },
        });
        await setVehicleConsumptionRates();
        console.log(
            `Added ascended fuel properties for Vehicle Model: ${Rebar.utility.vehicleHashes.getNameFromHash(vehicle.model)} | Fuel: ${vehicleDocument.getField('fuel')}`,
        );
    } catch (error) {
        console.error('Error while setting ASCENDED-Fuel Properties:', error);
    }
}

export function startTracking(player: alt.Player) {
    const vehicle = player.vehicle;
    if (!vehicle) return;

    const rebarDocument = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!rebarDocument) return;

    vehicleData.set(vehicle.id, {
        position: vehicle.pos,
        fuel: rebarDocument.fuel,
        consumptionRate: rebarDocument.ascendedFuel.consumption,
        timestamp: Date.now(),
    });
}

export async function updateFuelConsumption(player: alt.Player): Promise<void> {
    try {
        const vehicle = player.vehicle;
        if (!vehicle) return;

        const rebarVehicle = Rebar.document.vehicle.useVehicle(vehicle).get();
        if (!rebarVehicle) return;

        const initialData = vehicleData.get(vehicle.id);
        if (!initialData) return;

        const { position: initialPos, fuel: initialFuel, timestamp: initialTime } = initialData;
        const currentPos = vehicle.pos;
        const currentTime = Date.now();

        const distance = Rebar.utility.vector.distance(currentPos, initialPos);
        const timeElapsed = (currentTime - initialTime) / 1000;
        if (timeElapsed <= 0) return;

        const speed = distance / timeElapsed;
        if (distance === 0 || speed === 0) return;

        const baseFuelConsumptionRate = await getVehicleFuelConsumption(vehicle);
        const adjustedFuelConsumptionRate = baseFuelConsumptionRate * (1 + speed / 100);
        const fuelConsumed = distance * adjustedFuelConsumptionRate;
        const remainingFuel = Math.max(0, initialFuel - fuelConsumed);

        if (remainingFuel <= 0 && vehicle.engineOn) {
            await handleOutOfFuel(player, vehicle);
            return;
        }

        await updateVehicleFuel(vehicle, remainingFuel);
        updateVehicleData(vehicle, currentPos, remainingFuel, currentTime);

        await checkFuelTypeMismatch(player, vehicle);
    } catch (error) {
        handleError(error, 'updateFuelConsumption');
    }
}

async function handleOutOfFuel(player: alt.Player, vehicle: alt.Vehicle) {
    await toggleEngineWithoutPlayer(vehicle);
    if (FUEL_SETTINGS.AscNotification && NotificationAPI) {
        NotificationAPI.create(player, {
            icon: '⛽',
            title: 'Ascended Fuel',
            subTitle: 'Fuel ran out',
            message: 'Your vehicle ran out of fuel.',
        });
    }
    await updateVehicleFuel(vehicle, 0);
    updateVehicleData(vehicle, vehicle.pos, 0, Date.now());
}

async function updateVehicleFuel(vehicle: alt.Vehicle, fuel: number) {
    await Rebar.document.vehicle.useVehicle(vehicle).set('fuel', parseFloat(fuel.toFixed(2)));
}

function updateVehicleData(vehicle: alt.Vehicle, position: alt.Vector3, fuel: number, timestamp: number) {
    vehicleData.set(vehicle.id, { position, fuel, consumptionRate: 0, timestamp });
}

async function checkFuelTypeMismatch(player: alt.Player, vehicle: alt.Vehicle) {
    const ascendedFuel = await getAscendedFuel(vehicle);
    if (ascendedFuel && ascendedFuel.typeTanked !== ascendedFuel.type) {
        if (!timeoutSet.has(vehicle.id)) {
            timeoutSet.add(vehicle.id);
            setTimeout(() => {
                breakEngine(player, vehicle);
                timeoutSet.delete(vehicle.id);
            }, 2000);
        }
    }
}

export async function setVehicleConsumptionRates() {
    const vehicles = alt.Vehicle.all;

    for (const vehicle of vehicles) {
        try {
            const vehicleDocument = Rebar.document.vehicle.useVehicle(vehicle);
            const config = getVehicleConsumption(vehicle.model);

            await vehicleDocument.setBulk({
                ascendedFuel: {
                    consumption: config.consume,
                    max: config.maxFuel,
                    type: config.type || FUEL_SETTINGS.DefaultFuel,
                    typeTanked: config.type || FUEL_SETTINGS.DefaultFuel,
                },
            });
        } catch (error) {
            handleError(error, `setVehicleConsumptionRates for model ${vehicle.model}`);
        }
    }
}

export async function toggleEngine(player: alt.Player) {
    const playersVehicle = player.vehicle;
    if (!playersVehicle || player.seat !== 1) return;

    const rebarVehicle = Rebar.document.vehicle.useVehicle(playersVehicle).get();
    if (!rebarVehicle || !rebarVehicle.ascendedFuel) {
        Rebar.vehicle.useVehicle(playersVehicle).toggleEngine();
        return;
    }

    if (
        playersVehicle.hasStreamSyncedMeta('engineIsDisabled') &&
        playersVehicle.getStreamSyncedMeta('engineIsDisabled')
    ) {
        return;
    }

    const fuel = rebarVehicle.fuel;

    if (!playersVehicle.engineOn && fuel <= 0) {
        if (FUEL_SETTINGS.AscNotification && NotificationAPI) {
            NotificationAPI.create(player, {
                icon: '⛽',
                title: 'Ascended Fuel',
                subTitle: 'Empty Fuel',
                message: `There's no fuel left in your current vehicle.`,
            });
        }
        return;
    }

    if (FUEL_SETTINGS.enableSound) {
        Rebar.player.useAudio(player).playSound(`/sounds/engine.ogg`);
    }

    for (const _player of Object.values(playersVehicle.passengers)) {
        alt.emitClient(_player, 'ResetRPM');
    }

    Rebar.vehicle.useVehicle(playersVehicle).toggleEngineAsPlayer(player);
}

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

async function breakEngine(player: alt.Player, vehicle: alt.Vehicle) {
    await toggleEngineWithoutPlayer(vehicle);
    if (FUEL_SETTINGS.AscNotification && NotificationAPI) {
        const ascendedFuel = await getAscendedFuel(vehicle);
        if (ascendedFuel) {
            NotificationAPI.create(player, {
                icon: '⚠️',
                title: 'Engine Failure',
                subTitle: 'Fuel Type Mismatch',
                message: `Your vehicle engine has broken down due to fuel type mismatch. You've used ${ascendedFuel.typeTanked} instead of ${ascendedFuel.type}!`,
            });
        }
    }
}

// * Use this Section for Custom Fuelstations - Or if you use ASC-Fuel Stations dont worry about it. * //
export async function refillVehicle(player: alt.Player, amount?: number) {
    if (!player.vehicle) return;

    const vehicleDoc = Rebar.document.vehicle.useVehicle(player.vehicle);
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

    updateVehicleData(player.vehicle, player.vehicle.pos, newFuel, Date.now());
    await updateFuelConsumption(player);

    if (FUEL_SETTINGS.AscNotification && NotificationAPI) {
        NotificationAPI.create(player, {
            icon: '⛽',
            title: 'Ascended Fuel',
            subTitle: 'Refueled',
            message: `Vehicle refueled. New fuel level: ${newFuel.toFixed(2)}L`,
        });
    }
}

export async function refillClosestVehicle(player: alt.Player, amount: number, type?: string, duration = 5000) {
    const closeVehicle = Rebar.get.useVehicleGetter().closestVehicle(player, 5);
    if (!closeVehicle || player.vehicle) return;

    Rebar.player.useAnimation(player).playFinite('mini@repair', 'fixing_a_ped', 1, duration);

    alt.setTimeout(async () => {
        const document = Rebar.document.vehicle.useVehicle(closeVehicle);
        const vehicleDocument = document.get();
        if (!vehicleDocument || !vehicleDocument.ascendedFuel) return;

        const maxFuel = vehicleDocument.ascendedFuel.max;
        const newFuel = parseFloat(Math.min(document.getField('fuel') + amount, maxFuel).toFixed(2));

        vehicleDocument.ascendedFuel.typeTanked =
            vehicleDocument.ascendedFuel.type !== type ? type : vehicleDocument.ascendedFuel.typeTanked;

        await document.setBulk({
            fuel: newFuel,
            ascendedFuel: vehicleDocument.ascendedFuel,
        });

        updateVehicleData(closeVehicle, closeVehicle.pos, newFuel, Date.now());

        console.log(`Refueled closest vehicle - New Fuel Level: ${newFuel}L`);
    }, duration);
}

export async function getVehicleFuelType(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.type || null;
}

export async function getVehicleFuelTypeTanked(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.typeTanked || null;
}

export async function getVehicleFuelConsumption(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.consumption || 0;
}

export async function getVehicleMaxFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel?.max || 0;
}

export async function getVehicleFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.fuel || 0;
}

export async function getAscendedFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    return rebarVehicle?.ascendedFuel || null;
}
