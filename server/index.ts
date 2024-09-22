import * as alt from 'alt-server';
import {
    createAscendedFuelPropertie,
    getVehicleFuel,
    getVehicleMaxFuel,
    startTracking,
    updateFuelConsumption,
} from './src/functions.js';
import './src/api.js';
import './src/keybind.js';

import { FUEL_SETTINGS } from './src/config.js';
import { useApi } from '@Server/api/index.js';

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
    if (FUEL_SETTINGS.AscHUD && !FUEL_SETTINGS.ASCHUDPro) {
        const HudAPI = await useApi().getAsync('ascended-hud-api');
        const fuelCalc = await getFuelData(player.vehicle);
        HudAPI.pushData(player, HudAPI.GetHUDEvents().WebView.PUSH_FUEL, fuelCalc, true);
    }

    if (FUEL_SETTINGS.ASCHUDPro && !FUEL_SETTINGS.AscHUD) {
        const HudAPI = await useApi().getAsync('ascended-hudPro-api');
        const fuelCalc = await getFuelData(player.vehicle);
        HudAPI.pushData(player, HudAPI.GetHUDEvents().ToWebview.PushFuel, fuelCalc, true);
    }
}

alt.setInterval(async () => {
    for (const player of alt.Player.all.filter((player) => player.vehicle && player.vehicle.engineOn)) {
        updateFuelConsumption(player);
        await updateVehicleFuelData(player);
    }
}, 1000);

// Checks for updates...
if (FUEL_SETTINGS.checkForUpdates) {
    const fuelVersion = 'v2.0.0';
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

            const message = `[ASCENDED-API]: Your plugin: ${data.repository} is ${
                data.isOutdated ? 'outdated' : 'up to date'
            }. Latest Commit: ${data.latestCommit} | Version (${data.release}) | ${data.releasedAt}`;

            data.isOutdated ? alt.logWarning(message) : alt.log(message);
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

alt.on('rebar:vehicleBound', async (vehicle: alt.Vehicle) => {
    await createAscendedFuelPropertie(vehicle);
});
