import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import { getVehicleFuelConsumption, getVehicleFuelType, getVehicleMaxFuel, refillClosestVehicle, refillVehicle, setVehicleConsumptionRates, toggleEngine } from './functions.js';

function useFuelAPI() {
    async function setConsumptionRates() {
        await setVehicleConsumptionRates();
    }

    function toggleVehicleEngine(player: alt.Player) {
        toggleEngine(player);
    }

    async function getFuelType(model: alt.Vehicle) {
        await getVehicleFuelType(model)
    }

    async function getFuelConsumption(model: alt.Vehicle) {
        await getVehicleFuelConsumption(model);
    }

    async function refill(player: alt.Player) {
        await refillVehicle(player);
    } 

    async function refillCloseVehicle(player: alt.Player, amount: number) {
        await refillClosestVehicle(player, amount);
    }

    async function getMaxFuel(model: alt.Vehicle) {
        return await getVehicleMaxFuel(model);
    }

    return {
        setConsumptionRates,
        toggleVehicleEngine,
        getFuelType,
        getFuelConsumption,
        refill,
        refillCloseVehicle,
        getMaxFuel
    }
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: ReturnType<typeof useFuelAPI>;
    }
}

useApi().register('ascended-fuel-api', useFuelAPI());