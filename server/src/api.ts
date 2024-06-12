import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import { getVehicleFuelConsumption, getVehicleFuelType, getVehicleMaxFuel, refillVehicle, setVehicleConsumptionRates, setVehicleFuelTypes } from './functions.js';

function useFuelAPI() {
    async function setFuelTypes() {
        await setVehicleFuelTypes();
    }

    async function setConsumptionRates() {
        await setVehicleConsumptionRates();
    }

    async function getFuelType(model: string) {
        await getVehicleFuelType(model)
    }

    async function getFuelConsumption(model: string) {
        await getVehicleFuelConsumption(model);
    }

    async function refill(player: alt.Player) {
        await refillVehicle(player);
    } 

    async function getMaxFuel(model: string | number) {
        return await getVehicleMaxFuel(model);
    }

    return {
        setFuelTypes,
        setConsumptionRates,
        getFuelType,
        getFuelConsumption,
        refill,
        getMaxFuel
    }
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: ReturnType<typeof useFuelAPI>;
    }
}

useApi().register('ascended-fuel-api', useFuelAPI());