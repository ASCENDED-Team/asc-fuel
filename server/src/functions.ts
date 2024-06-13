import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { DIESEL, ELECTRIC, FUEL_SETTINGS, GASOLIN, KEROSIN, VEHICLE_CONSUMPTION } from './config.js';
import { Vehicle } from '@Shared/types/vehicle.js';
import { FUEL_TYPES } from './fuelTypes.js';

const Rebar = useRebar();
const database = Rebar.database.useDatabase();

const vehicleData = new Map();

export function startTracking(player: alt.Player) {
    const vehicle = player.vehicle;
    if (!vehicle) return;

    vehicleData.set(vehicle.id, {
        position: vehicle.pos,
        fuel: Rebar.document.vehicle.useVehicle(vehicle).get().fuel,
        consumptionRate: Rebar.document.vehicle.useVehicle(vehicle).get().ascendedFuel.consumption,
        timestamp: Date.now(),
    });
}

export async function updateFuelConsumption(player: alt.Player): Promise<void> {
    const vehicle = player.vehicle;
    if (!vehicle || !vehicleData.has(vehicle.id)) return;

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

    if (speed > 0) {
        Rebar.document.vehicle.useVehicle(vehicle).set('fuel', remainingFuel);

        vehicleData.set(vehicle.id, {
            position: currentPos,
            fuel: remainingFuel,
            timestamp: currentTime,
        });

        console.log(`Remaining Fuel: ${remainingFuel}`);
    }
}

export async function setVehicleFuelTypes() {
    const fuelVehicles = [
        ...GASOLIN.map((vehicle) => ({ model: vehicle, fuelType: FUEL_TYPES.Gasolin })),
        ...KEROSIN.map((vehicle) => ({ model: vehicle, fuelType: FUEL_TYPES.Kerosin })),
        ...DIESEL.map((vehicle) => ({ model: vehicle, fuelType: FUEL_TYPES.Diesel })),
        ...ELECTRIC.map((vehicle) => ({ model: vehicle, fuelType: FUEL_TYPES.Electric })),
    ];

    for (const veh of fuelVehicles) {
        try {
            const dbVehicle = await database.get<Vehicle>({ model: alt.hash(veh.model) }, 'Vehicles');

            if (dbVehicle) {
                dbVehicle.ascendedFuel.type = veh.fuelType;
                await database.update(dbVehicle, 'Vehicles');
            }
        } catch (error) {
            console.error(`Failed to update vehicle model ${veh.model}:`, error);
        }
    }
}

export async function getVehicleFuelType(model: string) {
    const dbVehicle = await database.get<Vehicle>({ model: alt.hash(model) }, 'Vehicles');

    return dbVehicle.ascendedFuel.type;
}

export async function setVehicleConsumptionRates() {
    const vehicles = alt.Vehicle.all;

    const consumptionData = VEHICLE_CONSUMPTION.reduce((acc, { model, consume, maxFuel }) => {
        acc[model] = { consume, maxFuel };
        return acc;
    }, {});

    for (const veh of vehicles) {
        const document = Rebar.document.vehicle.useVehicle(veh).get();
        const model = veh.model;
        const data = consumptionData[model];

        if (data) {
            try {
                Rebar.document.vehicle.useVehicle(veh).setBulk({
                    ascendedFuel: {
                        consumption: data.consume,
                        max: data.maxFuel,
                    },
                });
            } catch (error) {
                console.error(`Failed to update vehicle model ${model}:`, error);
            }
        } else if (data === undefined) {
            try {
                Rebar.document.vehicle.useVehicle(veh).setBulk({
                    ascendedFuel: {
                        consumption: FUEL_SETTINGS.DefaultConsumption,
                        max: FUEL_SETTINGS.DefaultMax,
                        type: FUEL_SETTINGS.DefaultFuel,
                    },
                });

                console.warn(
                    `No consumption data found for vehicle model ${model}. Stored default values to Database.`,
                );
            } catch (error) {
                console.error(`Failed to update vehicle model ${model} with default values:`, error);
            }
        }
    }
}

export async function getVehicleFuelConsumption(veh: alt.Vehicle) {
    return Rebar.document.vehicle.useVehicle(veh).get().ascendedFuel.consumption;
}

export async function getVehicleMaxFuel(veh: alt.Vehicle) {
    return Rebar.document.vehicle.useVehicle(veh).get().ascendedFuel.max;
}

export async function getVehicleFuel(veh: alt.Vehicle) {
    return Rebar.document.vehicle.useVehicle(veh).getField('fuel');
}

export async function refillVehicle(player: alt.Player) {
    if(!player.vehicle) return;

    const document = Rebar.document.vehicle.useVehicle(player.vehicle).get();

    Rebar.document.vehicle.useVehicle(player.vehicle).setBulk({
        fuel: document.ascendedFuel.max,
        ascendedFuel: {
            consumption: document.ascendedFuel.consumption,
            max: document.ascendedFuel.max,
            type: document.ascendedFuel.type,
        },
    });

    vehicleData.set(player.vehicle.id, {
        position: player.vehicle.pos,
        fuel: document.ascendedFuel.max,
        consumptionRate: document.ascendedFuel.consumption,
        timestamp: Date.now(),
    });

    console.log(`Refilled Vehicle: ${document.model} to ${document.ascendedFuel.max} - New Fuel is: ${document.fuel}`);

    updateFuelConsumption(player);
}

export async function refillClosestVehicle(player: alt.Player, amount: number) {
    const closeVehicle = Rebar.get.useVehicleGetter().closestVehicle(player, 5);

    console.log(`Close Vehicle: ${closeVehicle}`)
    if(!closeVehicle) return;

    const document = Rebar.document.vehicle.useVehicle(closeVehicle).get();

    Rebar.player.useAnimation(player).playFinite('mini@repair', 'fixing_a_ped', 1, 5000);
    alt.setTimeout(() => {
        Rebar.document.vehicle.useVehicle(closeVehicle).setBulk({
            fuel: document.ascendedFuel.max,
            ascendedFuel: {
                consumption: document.ascendedFuel.consumption,
                max: document.ascendedFuel.max,
                type: document.ascendedFuel.type,
            },
        });
    
        vehicleData.set(closeVehicle.id, {
            position: closeVehicle.pos,
            fuel: amount,
            consumptionRate: document.ascendedFuel.consumption,
            timestamp: Date.now(),
        });
    
        console.log(`Refilled Vehicle: ${document.model} to ${document.ascendedFuel.max} - New Fuel is: ${document.fuel}`);
    }, 5000)
}
