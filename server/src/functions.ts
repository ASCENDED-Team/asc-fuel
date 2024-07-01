import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { FUEL_SETTINGS, VEHICLE_CONSUMPTION } from './config.js';
import { useApi } from '@Server/api/index.js';

const Rebar = useRebar();
const vehicleData = new Map();
const timeoutSet = new Set<number>();

declare module 'alt-shared' {
    export interface ICustomVehicleStreamSyncedMeta {
        engineIsDisabled: boolean;
    }
}

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
if (FUEL_SETTINGS.AscNotification) {
    NotificationAPI = await useApi().getAsync('ascended-notification-api');
}

export function startTracking(player: alt.Player) {
    const vehicle = player.vehicle;
    const rebarDocument = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!vehicle || !rebarDocument) return;

    vehicleData.set(vehicle.id, {
        position: vehicle.pos,
        fuel: rebarDocument.fuel,
        consumptionRate: rebarDocument.ascendedFuel.consumption,
        timestamp: Date.now(),
    });
}

export async function updateFuelConsumption(player: alt.Player): Promise<void> {
    const vehicle = player.vehicle;

    if (!vehicle) {
        console.log('No vehicle found for the player.');
        return;
    }

    const rebarVehicle = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!rebarVehicle) {
        console.log('No rebar vehicle data found.');
        return;
    }

    const initialData = vehicleData.get(vehicle.id);
    if (!initialData) {
        console.log('No initial vehicle data found.');
        return;
    }

    const { position: initialPos, fuel: initialFuel, timestamp: initialTime } = initialData;
    const currentPos = vehicle.pos;
    const currentTime = Date.now();

    const distance = Rebar.utility.vector.distance(currentPos, initialPos);

    const timeElapsed = (currentTime - initialTime) / 1000;
    if (timeElapsed <= 0) {
        return;
    }

    const speed = distance / timeElapsed;
    if (distance === 0 || speed === 0) {
        return;
    }

    const baseFuelConsumptionRate = await getVehicleFuelConsumption(vehicle);
    const adjustedFuelConsumptionRate = baseFuelConsumptionRate * (1 + speed / 100);
    const fuelConsumed = distance * adjustedFuelConsumptionRate;
    const remainingFuel = Math.max(0, initialFuel - fuelConsumed);

    if (remainingFuel <= 0 && vehicle.engineOn) {
        toggleEngineWithoutPlayer(vehicle);
        if (FUEL_SETTINGS.AscNotification) {
            NotificationAPI.create(player, {
                icon: '⛽',
                title: 'Ascended Fuel',
                subTitle: 'Fuel ran out',
                message: 'Your vehicle ran out of fuel.',
            });
        }

        vehicleData.set(vehicle.id, {
            position: currentPos,
            fuel: 0,
            timestamp: currentTime,
        });
        Rebar.document.vehicle.useVehicle(vehicle).set('fuel', 0);

        return;
    }

    Rebar.document.vehicle.useVehicle(vehicle).set('fuel', parseFloat(remainingFuel.toFixed(2)));

    vehicleData.set(vehicle.id, {
        position: currentPos,
        fuel: parseFloat(remainingFuel.toFixed(2)),
        timestamp: currentTime,
    });

    const ascendedFuel = await getAscendedFuel(vehicle);
    if (ascendedFuel && ascendedFuel.typeTanked !== ascendedFuel.type) {
        if (!timeoutSet.has(vehicle.id)) {
            timeoutSet.add(vehicle.id);
            setTimeout(() => {
                breakEngine(player, vehicle);
                timeoutSet.delete(vehicle.id);
            }, 10000);
        }
        return;
    }
}

async function breakEngine(player: alt.Player, vehicle: alt.Vehicle) {
    toggleEngineWithoutPlayer(vehicle);
    if (FUEL_SETTINGS.AscNotification) {
        const ascendedFuel = await getAscendedFuel(vehicle);
        if (ascendedFuel) {
            NotificationAPI.create(player, {
                icon: '⚠️',
                title: 'Engine Failure',
                subTitle: 'Fuel Type Mismatch',
                message: `Your vehicle engine has broken down due to fuel type mismatch. You idiot have tanked ${ascendedFuel.typeTanked} instead of ${ascendedFuel.type}!`,
            });
        }
    }
}

export async function setVehicleConsumptionRates() {
    const vehicles = alt.Vehicle.all;

    const consumptionData = VEHICLE_CONSUMPTION.reduce((acc, { model, consume, type, maxFuel }) => {
        acc[model] = { consume, type: type || FUEL_SETTINGS.DefaultFuel, maxFuel };
        return acc;
    }, {});

    for (const veh of vehicles) {
        const model = veh.model;
        const data = consumptionData[model];
        console.log(JSON.stringify(data, undefined, 4));
        try {
            const vehicleDocument = Rebar.document.vehicle.useVehicle(veh);

            if (data) {
                await new Promise<void>((resolve) => {
                    alt.setTimeout(async () => {
                        await vehicleDocument.setBulk({
                            ascendedFuel: {
                                consumption: data.consume,
                                max: data.maxFuel,
                                type: data.type,
                                typeTanked: data.type,
                            },
                        });
                        resolve();
                    }, 250);
                });
            } else {
                await new Promise<void>((resolve) => {
                    alt.setTimeout(async () => {
                        await vehicleDocument.setBulk({
                            ascendedFuel: {
                                consumption: FUEL_SETTINGS.DefaultConsumption,
                                max: FUEL_SETTINGS.DefaultMax,
                                type: FUEL_SETTINGS.DefaultFuel,
                                typeTanked: FUEL_SETTINGS.DefaultFuel,
                            },
                        });
                        resolve();
                    }, 250);
                });
            }
        } catch (error) {
            console.error(`Failed to update vehicle model ${model}:`, error);
        }
    }
}

export function toggleEngine(player: alt.Player) {
    const playersVehicle = player.vehicle;
    if (!playersVehicle || player.seat !== 1) return;

    const rebarVehicle = Rebar.document.vehicle.useVehicle(playersVehicle).get();

    if (!rebarVehicle || !rebarVehicle.ascendedFuel) {
        Rebar.vehicle.useVehicle(playersVehicle).toggleEngine();
        return;
    }

    if (playersVehicle.hasStreamSyncedMeta('engineIsDisabled')) {
        const engineIsDisabled = playersVehicle.getStreamSyncedMeta('engineIsDisabled');
        if (engineIsDisabled) {
            return;
        }
    }

    const fuel = rebarVehicle.fuel;

    if (playersVehicle.engineOn === false) {
        if (fuel <= 0) {
            if (FUEL_SETTINGS.AscNotification) {
                NotificationAPI.create(player, {
                    icon: '⛽',
                    title: 'Ascended Fuel',
                    subTitle: 'Empty Fuel',
                    message: `There's no fuel left in your current vehicle. `,
                });
            }

            return;
        }

        if (FUEL_SETTINGS.enableSound) {
            Rebar.player.useAudio(player).playSound(`/sounds/engine.ogg`);
        }
    }

    let vehiclePlayers = playersVehicle.passengers;
    for (const [seat, _player] of Object.entries(vehiclePlayers)) {
        alt.emitClient(_player, 'ResetRPM');
    }

    Rebar.vehicle.useVehicle(playersVehicle).toggleEngineAsPlayer(player);
}

export function toggleEngineWithoutPlayer(vehicle: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(vehicle).get();

    if (!rebarVehicle || !rebarVehicle.ascendedFuel) {
        Rebar.vehicle.useVehicle(vehicle).toggleEngine();
        return;
    }

    const fuel = rebarVehicle.fuel;

    if (vehicle.engineOn === false) {
        // put all functionality that is needed before the engine gets started in here

        if (fuel <= 0) {
            alt.logWarning('vehicle has no fuel');
            return;
        }

        if (vehicle.hasStreamSyncedMeta('engineIsDisabled')) {
            const engineIsDisabled = vehicle.getStreamSyncedMeta('engineIsDisabled');
            if (engineIsDisabled) {
                return;
            }
        }
    } else {
        // put all functionality that is needed before the engine gets stoped in here

        let vehiclePlayers = vehicle.passengers;
        for (const [seat, _player] of Object.entries(vehiclePlayers)) {
            alt.emitClient(_player, 'ResetRPM');
        }
    }

    Rebar.vehicle.useVehicle(vehicle).toggleEngine();
}

export async function getVehicleFuelType(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.ascendedFuel.type;
}

export async function getVehicleFuelTypeTanked(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.ascendedFuel.typeTanked;
}

export async function getVehicleFuelConsumption(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.ascendedFuel.consumption;
}

export async function getVehicleMaxFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.ascendedFuel.max;
}

export async function getVehicleFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.fuel;
}

export async function getAscendedFuel(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.ascendedFuel;
}

export async function refillVehicle(player: alt.Player, amount: number) {
    if (!player.vehicle) return;

    const vehicleDoc = Rebar.document.vehicle.useVehicle(player.vehicle);
    const document = vehicleDoc.get();

    if (!amount) {
        amount = document.ascendedFuel.max;
        document.fuel = amount;
        console.log(`Max fill => ${document.fuel} | AMOUNT: ${amount}`);
    } else {
        document.fuel = Math.min(document.fuel + amount, document.ascendedFuel.max);
        console.log(`New Fuel is: ${document.fuel}`);
    }

    vehicleDoc.setBulk({
        fuel: parseFloat(document.fuel.toFixed(2)),
        ascendedFuel: { ...document.ascendedFuel },
    });

    vehicleData.set(player.vehicle.id, {
        fuel: document.fuel,
        position: player.vehicle.pos,
        consumptionRate: document.ascendedFuel.consumption,
        timestamp: Date.now(),
    });

    updateFuelConsumption(player);
}

export async function refillClosestVehicle(player: alt.Player, amount: number, type?: string, duration = 5000) {
    const closeVehicle = Rebar.get.useVehicleGetter().closestVehicle(player, 5);
    if (!closeVehicle || player.vehicle) return;

    Rebar.player.useAnimation(player).playFinite('mini@repair', 'fixing_a_ped', 1, duration);

    alt.setTimeout(() => {
        const document = Rebar.document.vehicle.useVehicle(closeVehicle);
        const vehicleDocument = document.get();
        const maxFuel = vehicleDocument.ascendedFuel.max;
        const newFuel = parseFloat(Math.min(document.getField('fuel') + amount, maxFuel).toFixed(2));

        vehicleDocument.ascendedFuel.typeTanked = type;
        document.set('fuel', newFuel);
        document.setBulk({ ascendedFuel: vehicleDocument.ascendedFuel });

        vehicleData.set(closeVehicle.id, {
            position: closeVehicle.pos,
            fuel: newFuel,
            consumptionRate: vehicleDocument.ascendedFuel.consumption,
            timestamp: Date.now(),
        });

        console.log(`Refueled closest Vehicle - New Fuel Level: ${newFuel}L`);
    }, duration);
}
