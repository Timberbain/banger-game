/**
 * Map metadata registry
 * Shared between client and server for consistent map loading and spawn points
 */
export interface MapMetadata {
    name: string;
    displayName: string;
    file: string;
    tileset: string;
    width: number;
    height: number;
    spawnPoints: {
        paran: {
            x: number;
            y: number;
        };
        guardians: [{
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }];
    };
}
export declare const MAPS: MapMetadata[];
