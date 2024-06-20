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
import { FUEL_SETTINGS, FUEL_TYPES } from './config.js';

function useFuelAPI() {
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
