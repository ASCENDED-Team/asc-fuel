import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import {
    getVehicleFuelConsumption,
    getVehicleFuelType,
    getVehicleMaxFuel,
    refillClosestVehicle,
    refillVehicle,
    setVehicleConsumptionRates,
    toggleEngine,
} from './functions.js';
import { FUEL_TYPES } from './config.js';
import { useRebar } from '@Server/index.js';
import { Vehicle } from '@Shared/types/vehicle.js';

const Rebar = useRebar();
function useFuelAPI() {
    async function createAscendedFuelProperties() {
        try {
            // Step 1: Retrieve all vehicles from the database
            const allVehicles = await Rebar.database.useDatabase().getAll<{ _id: string }>('Vehicles');

            // Step 2: Iterate over each vehicle
            for (const vehicle of allVehicles) {
                // Step 3: Check if the vehicle has ascendedFuel property
                const currentVehicle = await Rebar.database
                    .useDatabase()
                    .get<Vehicle>({ _id: vehicle._id }, 'Vehicles');

                if (!currentVehicle.ascendedFuel) {
                    // Step 4: Set ascendedFuel property if missing
                    await Rebar.database
                        .useDatabase()
                        .update<Vehicle>({ _id: vehicle._id }, { $set: { ascendedFuel: true } }, 'Vehicles');
                    console.log(`Set ASCENDED-Fuel Properties for: ${currentVehicle.model}.`);
                }
            }
            console.log('All vehicles checked and updated successfully.');
        } catch (error) {
            console.error('Error while setting ASCENDED-Fuel Properties:', error);
        }
    }
    async function setConsumptionRates() {
        await setVehicleConsumptionRates();
    }

    function toggleVehicleEngine(player: alt.Player) {
        toggleEngine(player);
    }

    async function getFuelType(model: alt.Vehicle) {
        await getVehicleFuelType(model);
    }

    async function getFuelConsumption(model: alt.Vehicle) {
        await getVehicleFuelConsumption(model);
    }

    async function refill(player: alt.Player, amount?: number) {
        await refillVehicle(player, amount);
    }

    async function refillCloseVehicle(player: alt.Player, amount: number) {
        await refillClosestVehicle(player, amount);
    }

    async function getMaxFuel(model: alt.Vehicle) {
        await getVehicleMaxFuel(model);
    }

    function getFuelTypes() {
        return FUEL_TYPES;
    }

    return {
        setConsumptionRates,
        toggleVehicleEngine,
        getFuelType,
        getFuelConsumption,
        refill,
        refillCloseVehicle,
        getMaxFuel,
        getFuelTypes,
    };
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: ReturnType<typeof useFuelAPI>;
    }
}

useApi().register('ascended-fuel-api', useFuelAPI());
