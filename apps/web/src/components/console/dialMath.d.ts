export declare const DIAL_CAP_S: number;
export declare const DIAL_START: number;
export declare const DIAL_END: number;
export declare function dialFrac(seconds: number): number;
export declare function dialAngle(frac: number): number;
export declare function needleRotationZ(angle: number): number;
export declare function tickPosition(angle: number, r: number): [number, number];
export declare function needleTipPosition(angle: number, r: number): [number, number];
