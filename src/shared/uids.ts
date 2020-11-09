let uid_counter = 0;
let salt = "";
export type HashFunction = ( input:string )=>string;
let hash:HashFunction | undefined;
export function setSeed( seed:number ):void {
    salt = seed.toString();
}
export function setHashFunc( func:HashFunction ):void {
    hash = func;
}
export function getUid():string {
    if (salt == "") {
        throw new Error( "Please seed the UID generator before using it!" );
    }
    if (hash == null) {
        throw new Error( "Please assign a platform-dependent secure hash function!" );
    }
    return hash( salt + uid_counter++ );
}