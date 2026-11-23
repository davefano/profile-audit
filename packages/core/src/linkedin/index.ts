// The LinkedIn data layer: fetch, parse, and describe profiles. Nothing here
// judges anything; the audit rules live in ../audit.
//
// Copied from Fake Profile Reporter's packages/core/src/linkedin (commit
// 7c80425), profile half only. Endpoint fixes there likely apply here too.

export * from './session';
export * from './endpoints';
export * from './target';
export * from './ids';
export * from './join-estimate';
export * from './html';
export * from './rsc';

export * from './profile/snapshot';
export * from './profile/capture';
export * from './profile/facts';
