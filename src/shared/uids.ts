let uid_counter = 0;
let salt = "";
export type HashFunction = ( input:string )=>string;
let hash:HashFunction;
export function set_seed( seed:number ):void {
    salt = seed.toString();
}
export function set_hash_func( func:HashFunction ):void {
    hash = func;
}
export function get_uid():string {
    if (salt == "") {
        throw new Error( "Please seed the UID generator before using it!" );
    }
    if (hash == null) {
        throw new Error( "Please assign a platform-dependent secure hash function!" );
    }
    return hash( salt + uid_counter++ );
}