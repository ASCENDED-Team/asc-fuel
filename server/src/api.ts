import { useApi } from '@Server/api/index.js';
import {
    createAscendedFuelPropertie,
    getVehicleFuelConsumption,
    getVehicleFuelType,
    getVehicleMaxFuel,
    refillClosestVehicle,
    refillVehicle,
    repairFuelTypeMismatch,
    toggleEngine,
    toggleEngineWithoutPlayer,
} from './functions.js';
import { FUEL_TYPES } from './config.js';

class FuelAPI {
    public static global = {
        getFuelTypes: this.getFuelTypes,
    };

    public static vehicle = {
        createPropertie: createAscendedFuelPropertie,
        toggleEngine: toggleEngine,
        toggleEngineNoPlayer: toggleEngineWithoutPlayer,
        getFuelType: getVehicleFuelType,
        getConsumption: getVehicleFuelConsumption,
        refill: refillVehicle,
        refillClose: refillClosestVehicle,
        getMaxFuel: getVehicleMaxFuel,
        repairMismatch: repairFuelTypeMismatch,
    };

    private static getFuelTypes() {
        return FUEL_TYPES;
    }
}

declare global {
    export interface ServerPlugin {
        ['ascended-fuel-api']: typeof FuelAPI;
    }
}

useApi().register('ascended-fuel-api', FuelAPI);
