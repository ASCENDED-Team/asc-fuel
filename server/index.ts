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
    async function requestLatestVersion() {
        const apiKey = 'qcsWTe_olrldSoni3K8AHkTeDCeu2rJiG5AKeqAWBBc';
        const repoUrl = 'ascended-team/asc-fuel';
        const apiUrl = `http://api.rebar-ascended.dev:5072/versioncheck-api?url=${repoUrl}&version=dummy&apiKey=${apiKey}`;

        try {
            const commitResponse = await fetch(`https://api.github.com/repos/${repoUrl}/commits/main`);
            if (!commitResponse.ok) {
                throw new Error(`Failed to fetch commit hash: ${commitResponse.status}`);
            }
            const commitData = await commitResponse.json();
            const currentCommitHash = commitData.sha;

            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const data = await response.json();

            let message = `[\x1b[35mASCENDED-Repository\x1b[0m] => \x1b[35m${data.repository}\x1b[0m is `;
            if (currentCommitHash !== data.latestCommitHash) {
                message += `\x1b[31mUPDATED\x1b[0m`;
            } else {
                message += '\x1b[32mUPTODATE\x1b[0m';
            }
            message += `. Latest Commit: ${data.latestCommit} (${data.latestCommitHash.slice(0, 5)})`;

            currentCommitHash !== data.latestCommitHash ? alt.logWarning(message) : alt.log(message);
        } catch (error) {
            if (error.response) {
                alt.logWarning(
                    `[\x1b[35mASCENDED\x1b[0m-Versioncheck-API] => \x1b[31mNo Response from Ascended API Server...\x1b[0m Status: \x1b[35m${error.response.status}\x1b[0m`,
                );
            } else {
                alt.logWarning(
                    `[\x1b[35mASCENDED\x1b[0m-Versioncheck-API] => \x1b[31mNo Response from Ascended API Server...\x1b[0m \x1b[35m${error.message}\x1b[0m`,
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
