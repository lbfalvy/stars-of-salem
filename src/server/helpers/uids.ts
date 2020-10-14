import { createHash, randomInt } from "crypto";
/*
    Generating hard-to-guess uids.
*/
var uid_counter = 0;
const salt = randomInt(Number.MAX_SAFE_INTEGER).toString();
const hash = createHash('sha256');
export function get_uid():string {
    hash.update( salt + uid_counter++ );
    return hash.digest( 'latin1' );
}