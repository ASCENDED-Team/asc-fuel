import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import { getVehicleFuelConsumption, getVehicleFuelType, refillVehicle } from './functions.js';

function useFuelAPI() {
    function getFuelType(model: string) {
        getVehicleFuelType(model)
    }

    function getFuelConsumption(model: string) {
        getVehicleFuelConsumption(model);
    }

    function refill(player: alt.Player) {
        refillVehicle(player);
    } 

    return {
        getFuelType,
        getFuelConsumption,
        refill
    }
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: ReturnType<typeof useFuelAPI>;
    }
}

useApi().register('ascended-fuel-api', useFuelAPI());