declare module '@Shared/types/vehicle.js' {
    export interface Vehicle {
        ascendedFuel: {
            type: string;
            typeTanked?: string;
            consumption: number;
            max: number;
        };
    }
}
