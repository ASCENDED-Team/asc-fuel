import * as alt from 'alt-server';
import {
    getVehicleFuel,
    getVehicleMaxFuel,
    setVehicleConsumptionRates,
    startTracking,
    updateFuelConsumption,
} from './src/functions.js';
import './src/api.js';
import './src/keybind.js';

import { FUEL_SETTINGS } from './src/config.js';
import { useApi } from '@Server/api/index.js';

const HudAPI = await useApi().getAsync('ascended-hud-api');

alt.on('playerEnteredVehicle', async (player: alt.Player) => {
    startTracking(player);
    await updateVehicleFuelData(player);
});

const getFuelData = async (vehicle: alt.Vehicle) => {
    const fuel = await getVehicleFuel(vehicle);
    const maxFuel = await getVehicleMaxFuel(vehicle);
    return (fuel / maxFuel) * 100;
};

async function updateVehicleFuelData(player: alt.Player) {
    if (FUEL_SETTINGS.AscHUD) {
        const fuelCalc = await getFuelData(player.vehicle);
        HudAPI.pushData(player, HudAPI.GetHUDEvents().WebView.PUSH_FUEL, fuelCalc, true);
    }
}

alt.setInterval(async () => {
    const playersWithVehicles = alt.Player.all.filter((player) => player.vehicle);

    for (const player of playersWithVehicles) {
        if (!player.vehicle.engineOn) {
            return;
        }

        updateFuelConsumption(player);
        await updateVehicleFuelData(player);
    }
}, 1000);

alt.setTimeout(async () => {
    await setVehicleConsumptionRates();
}, 1500);

// Checks for updates...
if (FUEL_SETTINGS.checkForUpdates) {
    const fuelVersion = 'v1.04';
    async function requestLatestVersion() {
        /* 
        ASCENDED-Team API Key. This will only work for our plugins.
        If you want to use our version check API - Feel free to contact us!
        Our Discord: https://discord.gg/HTKM9NdhVa 
        */
        const apiKey = 'qcsWTe_olrldSoni3K8AHkTeDCeu2rJiG5AKeqAWBBc';
        const url = `http://api.rebar-ascended.dev:5072/versioncheck-api?url=ascended-team/asc-fuel&version=${fuelVersion}&apiKey=${apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const data: {
                repository: string;
                release: string;
                releasedAt: string;
                commitHash: string;
                latestCommit: string;
                isOutdated: boolean;
            } = await response.json();

            if (data.isOutdated) {
                alt.logWarning(
                    `[ASCENDED-API]: Your plugin: ${data.repository} is outdated. Latest Commit: ${data.latestCommit} | Version (${data.release}) | ${data.releasedAt}`,
                );
            } else {
                alt.logWarning(
                    `[ASCENDED-API]: Your plugin: ${data.repository} is up to date. Latest Commit: ${data.latestCommit} | Version (${data.release}) | ${data.releasedAt}`,
                );
            }
        } catch (error) {
            if (error.response) {
                alt.logWarning(
                    `[ASCENDED-Versioncheck-API] => No Response from Ascended API Server... Status: ${error.response.status}`,
                );
            } else {
                alt.logWarning(
                    `[ASCENDED-Versioncheck-API] => No Response from Ascended API Server... ${error.message}`,
                );
            }
        }
        return null;
    }

    setTimeout(() => {
        requestLatestVersion();
    }, 250);
}
