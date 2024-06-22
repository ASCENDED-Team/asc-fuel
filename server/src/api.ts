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
    async function createAscendedFuelPropertie(vehicle: alt.Vehicle) {
        try {
            const vehicleDocument = Rebar.document.vehicle.useVehicle(vehicle);
            await vehicleDocument.setBulk({
                fuel: 30,
                ascendedFuel: {
                    consumption: 0,
                    max: 0,
                    type: '',
                },
            });
            await setConsumptionRates();
            console.log(
                `Added ascended fuel properties for Vehicle Model: ${Rebar.utility.vehicleHashes.getNameFromHash(vehicle.model)} | Fuel: ${vehicleDocument.getField('fuel')}`,
            );
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

    async function getFuelType(vehicle: alt.Vehicle) {
        await getVehicleFuelType(vehicle);
    }

    async function getFuelConsumption(vehicle: alt.Vehicle) {
        await getVehicleFuelConsumption(vehicle);
    }

    async function refill(player: alt.Player, amount?: number) {
        await refillVehicle(player, amount);
    }

    async function refillCloseVehicle(player: alt.Player, amount: number) {
        await refillClosestVehicle(player, amount);
    }

    async function getMaxFuel(vehicle: alt.Vehicle) {
        await getVehicleMaxFuel(vehicle);
    }

    function getFuelTypes() {
        return FUEL_TYPES;
    }

    return {
        createAscendedFuelPropertie,
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
