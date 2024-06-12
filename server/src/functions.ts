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
        timestamp: Date.now()
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
        Math.pow(currentPos.z - initialPos.z, 2)
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

    const baseFuelConsumptionRate = await getVehicleFuelConsumption(vehicle.model);
    const adjustedFuelConsumptionRate = baseFuelConsumptionRate * (1 + speed / 100);
    const fuelConsumed = distance * adjustedFuelConsumptionRate;

    const remainingFuel = Math.max(0, initialFuel - fuelConsumed);

    if (speed > 0) {
        Rebar.document.vehicle.useVehicle(vehicle).set('fuel', remainingFuel);
        
        vehicleData.set(vehicle.id, {
            position: currentPos,
            fuel: remainingFuel,
            timestamp: currentTime
        });
    }
}

export async function setVehicleFuelTypes() {
    const fuelVehicles = [
        ...GASOLIN.map(vehicle => ({ model: vehicle, fuelType: FUEL_TYPES.Gasolin })),
        ...KEROSIN.map(vehicle => ({ model: vehicle, fuelType: FUEL_TYPES.Kerosin })),
        ...DIESEL.map(vehicle => ({ model: vehicle, fuelType: FUEL_TYPES.Diesel })),
        ...ELECTRIC.map(vehicle => ({ model: vehicle, fuelType: FUEL_TYPES.Electric }))
    ];

    for (const veh of fuelVehicles) {
        try {
            const dbVehicle = await database.get<Vehicle>({ 'model': alt.hash(veh.model) }, 'Vehicles');

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
    const dbVehicle = await database.get<Vehicle>({ 'model': alt.hash(model) }, 'Vehicles');

    return dbVehicle.ascendedFuel.type;
}

export async function setVehicleConsumptionRates() {
    const database = Rebar.database.useDatabase();
    const allVehicles = await database.getAll('Vehicles');

    const consumptionData = VEHICLE_CONSUMPTION.reduce((acc, { model, consume, maxFuel }) => {
        acc[model] = { consume, maxFuel };
        return acc;
    }, {});

    for (const veh of allVehicles) {
        const partialVehicle: Partial<Vehicle> = { _id: veh._id };
        const dbVehicle = await database.get<Vehicle>(partialVehicle, 'Vehicles');
        const data = consumptionData[dbVehicle.model];

        if (data) {
            dbVehicle.ascendedFuel.consumption = data.consume;
            dbVehicle.ascendedFuel.max = data.maxFuel;
            try {
                await database.update(dbVehicle, 'Vehicles');
            } catch (error) {
                console.error(`Failed to update vehicle model ${dbVehicle.model}:`, error);
            }
        } else {
            dbVehicle.ascendedFuel.type = FUEL_SETTINGS.DefaultFuel;
            dbVehicle.ascendedFuel.consumption = FUEL_SETTINGS.DefaultConsumption;
            dbVehicle.ascendedFuel.max = 60; 
            await database.update(dbVehicle, 'Vehicles');
            console.warn(`No consumption data found for vehicle model ${dbVehicle.model}. Stored default values to Database.`);
        }
    }
}

export async function getVehicleFuelConsumption(model: string | number) {
    if(typeof model === 'string') {
        alt.hash(model);
    }

    const dbVehicle = await database.get<Vehicle>({ 'model': model }, 'Vehicles');

    return dbVehicle.ascendedFuel.consumption;
};

export async function getVehicleMaxFuel(model: string | number) {
    if(typeof model === 'string') {
        alt.hash(model);
    }

    const dbVehicle = await database.get<Vehicle>({ 'model': model }, 'Vehicles');

    return dbVehicle.ascendedFuel.max;
}

export async function getVehicleFuel(model: string | number) {    
    if(typeof model === 'string') {
        alt.hash(model);
    }

    const dbVehicle = await database.get<Vehicle>({ 'model': model }, 'Vehicles');

    return dbVehicle.fuel;
}

export async function refillVehicle(player: alt.Player) {
    const document = Rebar.document.vehicle.useVehicle(player.vehicle).get();

    Rebar.document.vehicle.useVehicle(player.vehicle).set('fuel', document.ascendedFuel.max);

    await database.update(document, 'Vehicles');

    console.log(`Refilled Vehicle: ${document.model} to ${document.ascendedFuel.max} - New Fuel is: ${document.fuel}`);

    vehicleData.set(player.vehicle.id, {
        position: player.vehicle.pos,
        fuel: document.ascendedFuel.max,
        consumptionRate:document.ascendedFuel.consumption,
        timestamp: Date.now()
    });

    updateFuelConsumption(player);
}