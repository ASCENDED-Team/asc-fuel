import * as alt from 'alt-server';
import { useRebar } from '@Server/index.js';
import { Default_Consumption, GASOLIN, KEROSIN, VEHICLE_CONSUMPTION } from './config.js';
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
        consumptionRate: Rebar.document.vehicle.useVehicle(vehicle).get().consumptionRate,
    });
}

export async function updateFuelConsumption(player: alt.Player) {
    const vehicle = player.vehicle;
    if (!vehicle || !vehicleData.has(vehicle.id)) return;

    const initialData = vehicleData.get(vehicle.id);
    const initialPos = initialData.position;
    const initialFuel = initialData.fuel;

    const currentPos = vehicle.pos;
    
    const distance = Math.sqrt(
        Math.pow(currentPos.x - initialPos.x, 2) +
        Math.pow(currentPos.y - initialPos.y, 2) +
        Math.pow(currentPos.z - initialPos.z, 2)
    );

    const fuelConsumptionRate = await getVehicleFuelConsumption(player.vehicle.model);
    const fuelConsumed = distance * fuelConsumptionRate;

    const remainingFuel = Math.max(0, initialFuel - fuelConsumed);
    Rebar.document.vehicle.useVehicle(vehicle).set('fuel', remainingFuel);

    console.log(`Distance: ${distance} | Fuel: ${Rebar.document.vehicle.useVehicle(vehicle).get().fuel} | Consumption: ${fuelConsumptionRate} | Consumed: ${fuelConsumed}`)
    vehicleData.set(vehicle.id, {
        position: currentPos,
        fuel: remainingFuel
    });
}

export async function setVehicleFuelTypes() {
    const fuelVehicles = [
        ...GASOLIN.map(vehicle => ({ model: vehicle, fuelType: FUEL_TYPES.Gasolin })),
        ...KEROSIN.map(vehicle => ({ model: vehicle, fuelType: FUEL_TYPES.Kerosin }))
    ];

    for (const veh of fuelVehicles) {
        try {
            const dbVehicle = await database.get<Vehicle>({ 'model': alt.hash(veh.model) }, 'Vehicles');

            if (dbVehicle) {
                dbVehicle.fuelType = veh.fuelType;
                await database.update(dbVehicle, 'Vehicles');
            }
        } catch (error) {
            console.error(`Failed to update vehicle model ${veh.model}:`, error);
        }
    }
}

export async function getVehicleFuelType(model: string) {
    const dbVehicle = await database.get<Vehicle>({ 'model': model }, 'Vehicles');

    return dbVehicle.fuelType;
}

export async function setVehicleConsumptionRates() {
    const database = Rebar.database.useDatabase();
    const allVehicles = await database.getAll('Vehicles');

    const consumptionRates = VEHICLE_CONSUMPTION.reduce((acc, { model, consume }) => {
        acc[model] = consume;
        return acc;
    }, {});

    for (const veh of allVehicles) {
        const partialVehicle: Partial<Vehicle> = { _id: veh._id };
        const dbVehicle = await database.get<Vehicle>(partialVehicle, 'Vehicles');
        const rate = consumptionRates[dbVehicle.model];

        if (rate) {
            dbVehicle.consumptionRate = rate;
            try {
                await database.update(dbVehicle, 'Vehicles');
            } catch (error) {
                console.error(`Failed to update vehicle model ${dbVehicle.model}:`, error);
            }
        } else {
            dbVehicle.consumptionRate = Default_Consumption;
            await database.update(dbVehicle, 'Vehicles');
            console.warn(`No consumption rate found for fuel type ${dbVehicle.fuelType} of vehicle model ${dbVehicle.model}. Stored to Database.`);
        }
    }
}

export async function getVehicleFuelConsumption(model: string | number) {
    const dbVehicle = await database.get<Vehicle>({ 'model': model }, 'Vehicles');

    return dbVehicle.consumptionRate;
};