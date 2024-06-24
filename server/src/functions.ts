import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { FUEL_SETTINGS, VEHICLE_CONSUMPTION } from './config.js';
import { useApi } from '@Server/api/index.js';

const Rebar = useRebar();
const vehicleData = new Map();

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
    const rebarVehicle = Rebar.document.vehicle.useVehicle(vehicle).get();
    if (!vehicle || !rebarVehicle) return;

    const initialData = vehicleData.get(vehicle.id)!;
    const initialPos = initialData.position;
    const initialFuel = initialData.fuel;
    const initialTime = initialData.timestamp;

    const currentPos = vehicle.pos;
    const currentTime = Date.now();

    const distance = Math.sqrt(
        Math.pow(currentPos.x - initialPos.x, 2) +
            Math.pow(currentPos.y - initialPos.y, 2) +
            Math.pow(currentPos.z - initialPos.z, 2),
    );

    const timeElapsed = (currentTime - initialTime) / 1000;

    if (timeElapsed <= 0) {
        console.log('Time elapsed is zero or negative, skipping fuel consumption update.');
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
        toggleEngine(player);
        if (FUEL_SETTINGS.AscNotification) {
            NotificationAPI.create(player, {
                icon: '⛽',
                title: 'Ascended Fuel',
                subTitle: 'Fuel ran out',
                message: `Your vehicle ran out of fuel. `,
            });
        }
    }

    if (speed > 0) {
        Rebar.document.vehicle.useVehicle(vehicle).set('fuel', remainingFuel);

        vehicleData.set(vehicle.id, {
            position: currentPos,
            fuel: remainingFuel,
            timestamp: currentTime,
        });
    }
}

export async function setVehicleConsumptionRates() {
    const vehicles = alt.Vehicle.all;

    const consumptionData = VEHICLE_CONSUMPTION.reduce((acc, { model, consume, type, maxFuel }) => {
        acc[model] = { consume, type, maxFuel };
        return acc;
    }, {});

    for (const veh of vehicles) {
        const model = veh.model;
        const data = consumptionData[model];

        try {
            const vehicleDocument = Rebar.document.vehicle.useVehicle(veh);
            if (data && vehicleDocument) {
                if (!data.type) {
                    data.type = FUEL_SETTINGS.DefaultFuel;
                }

                alt.setTimeout(async () => {
                    await vehicleDocument.setBulk({
                        ascendedFuel: {
                            consumption: data.consume,
                            max: data.maxFuel,
                            type: data.type,
                        },
                    });
                }, 250);
            } else {
                await vehicleDocument.setBulk({
                    ascendedFuel: {
                        consumption: FUEL_SETTINGS.DefaultConsumption,
                        max: FUEL_SETTINGS.DefaultMax,
                        type: FUEL_SETTINGS.DefaultFuel,
                    },
                });
            }
        } catch (error) {
            if (data) {
                console.error(`Failed to update vehicle model ${model}:`, error);
            } else {
                console.error(`Failed to update vehicle model ${model} with default values:`, error);
            }
        }
    }
}

export function toggleEngine(player: alt.Player) {
    const playersVehicle = player.vehicle;
    if (!playersVehicle || player.seat !== 1) return;

    const rebarVehicle = Rebar.document.vehicle.useVehicle(playersVehicle).get();

    if (!rebarVehicle) {
        Rebar.vehicle.useVehicle(playersVehicle).toggleEngine();
        return;
    }

    const fuel = rebarVehicle.fuel;
    if (fuel <= 1 && playersVehicle.engineOn === false) {
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

    if (playersVehicle.engineOn === false && FUEL_SETTINGS.enableSound) {
        Rebar.player.useAudio(player).playSound(`/sounds/engine.ogg`);
    }

    Rebar.vehicle.useVehicle(playersVehicle).toggleEngineAsPlayer(player);
}

export async function getVehicleFuelType(veh: alt.Vehicle) {
    const rebarVehicle = Rebar.document.vehicle.useVehicle(veh).get();
    if (!rebarVehicle) return 0;

    return rebarVehicle.ascendedFuel.type;
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
        fuel: document.fuel,
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

export async function refillClosestVehicle(player: alt.Player, amount: number, duration = 5000) {
    const closeVehicle = Rebar.get.useVehicleGetter().closestVehicle(player, 5);
    if (!closeVehicle || player.vehicle) return;

    Rebar.player.useAnimation(player).playFinite('mini@repair', 'fixing_a_ped', 1, duration);

    alt.setTimeout(() => {
        const document = Rebar.document.vehicle.useVehicle(closeVehicle);
        const vehicleDocument = document.get();
        const maxFuel = vehicleDocument.ascendedFuel.max;
        const newFuel = Math.min(document.getField('fuel') + amount, maxFuel);

        document.setBulk({ fuel: newFuel });

        vehicleData.set(closeVehicle.id, {
            position: closeVehicle.pos,
            fuel: newFuel,
            consumptionRate: vehicleDocument.ascendedFuel.consumption,
            timestamp: Date.now(),
        });

        console.log(`Refueled closest Vehicle - New Fuel Level: ${newFuel}L`);
    }, duration);
}
