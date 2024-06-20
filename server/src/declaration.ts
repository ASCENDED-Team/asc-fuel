declare module '@Shared/types/vehicle.js' {
    export interface Vehicle {
        ascendedFuel: {
            type: string;
            consumption: number;
            max: number;
        };
    }
}
