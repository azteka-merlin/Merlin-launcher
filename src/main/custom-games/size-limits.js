// R2's technical maximum for one object: 5 TiB minus 5 GiB.
// This is a storage-platform boundary, not an application upload policy.
const MAX_R2_OBJECT_BYTES = 5 * 1024 ** 4 - 5 * 1024 ** 3;

module.exports = { MAX_R2_OBJECT_BYTES };
