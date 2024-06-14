import * as alt from 'alt-server';

import { useApi } from "@Server/api/index.js";
import { useKeybinder } from "@Server/systems/serverKeybinds.js";

const FuelAPI = await useApi().getAsync('ascended-fuel-api');
useKeybinder().on(88, (player: alt.Player) => {
    FuelAPI.toggleVehicleEngine(player);
});