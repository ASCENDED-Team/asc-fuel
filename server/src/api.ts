import * as alt from 'alt-server';

import { useApi } from '@Server/api/index.js';
import { getVehicleFuelType } from './functions.js';

function useFuelAPI() {
    function getFuelType(model: string) {
        getVehicleFuelType(model)
    }

    return {
        getVehicleFuelType,
    }
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: ReturnType<typeof useFuelAPI>;
    }
}

useApi().register('ascended-fuel-api', useFuelAPI());