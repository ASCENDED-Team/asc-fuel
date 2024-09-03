import { useApi } from '@Server/api/index.js';
import {
    createAscendedFuelPropertie,
    getVehicleFuelConsumption,
    getVehicleFuelType,
    getVehicleMaxFuel,
    refillClosestVehicle,
    refillVehicle,
    setVehicleConsumptionRates,
    toggleEngine,
    toggleEngineWithoutPlayer,
} from './functions.js';
import { FUEL_TYPES } from './config.js';

function useFuelAPI() {
    const global = {
        setConsumptionRates: setVehicleConsumptionRates,
        getFuelTypes: getFuelTypes,
    };
    const vehicle = {
        createPropertie: createAscendedFuelPropertie,
        toggleEngine: toggleEngine,
        toggleEngineNoPlayer: toggleEngineWithoutPlayer,
        getFuelType: getVehicleFuelType,
        getConsumption: getVehicleFuelConsumption,
        refill: refillVehicle,
        refillClose: refillClosestVehicle,
        getMaxFuel: getVehicleMaxFuel,
    };

    function getFuelTypes() {
        return FUEL_TYPES;
    }

    return {
        global,
        vehicle,
    };
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: ReturnType<typeof useFuelAPI>;
    }
}

useApi().register('ascended-fuel-api', useFuelAPI());
