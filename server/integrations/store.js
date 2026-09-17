const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT } = require('../config/env');

const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'runtime.json');
const MAX_INBOUND = 500;
const MAX_EVENTS = 400;

function blankState(){return { inbound: [], events: [], health: {}, crmJobs: [] };}
function ensureStore(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(DATA_FILE))fs.writeFileSync(DATA_FILE,JSON.stringify(blankState(),null,2));}
function normalizeState(data){const state=data&&typeof data==='object'?data:blankState();if(!Array.isArray(state.inbound))state.inbound=[];if(!Array.isArray(state.events))state.events=[];if(!state.health||typeof state.health!=='object'||Array.isArray(state.health))state.health={};if(!Array.isArray(state.crmJobs))state.crmJobs=[];return state;}
function readState(){ensureStore();try{return normalizeState(JSON.parse(fs.readFileSync(DATA_FILE,'utf8')));}catch{return blankState();}}
function writeState(state){ensureStore();const temp=`${DATA_FILE}.tmp`;fs.writeFileSync(temp,JSON.stringify(normalizeState(state),null,2));fs.renameSync(temp,DATA_FILE);}
function id(prefix){return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;}

function listInbound(){return readState().inbound.slice().sort((a,b)=>String(b.receivedAt).localeCompare(String(a.receivedAt)));}
function hasExternalId(externalId){return Boolean(externalId&&readState().inbound.some(item=>item.externalId===externalId));}
function getInboundByExternalId(externalId){return readState().inbound.find(item=>item.externalId===externalId)||null;}
function addInbound(item){const state=readState();if(item.externalId){const existing=state.inbound.find(x=>x.externalId===item.externalId);if(existing)return existing;}state.inbound.unshift(item);state.inbound=state.inbound.slice(0,MAX_INBOUND);writeState(state);return item;}
function clearInbound(){const state=readState();state.inbound=[];writeState(state);}
function logEvent({source='System',level='info',type='event',message='',itemId='',details={}}){const state=readState();const event={id:id('evt'),source,level,type,message,itemId,details,at:new Date().toISOString()};state.events.unshift(event);state.events=state.events.slice(0,MAX_EVENTS);writeState(state);return event;}
function setIntegrationHealth(channel,patch={}){const state=readState();state.health[channel]={...(state.health[channel]||{}),...patch,updatedAt:new Date().toISOString()};writeState(state);return state.health[channel];}
function listSystemState(){const state=readState();return {events:state.events.slice(0,30),health:state.health};}
function clearSystemState(){const state=readState();state.events=[];state.health={};writeState(state);}
function listCrmJobs(){return readState().crmJobs.slice();}
function replaceCrmJobs(jobs=[]){const state=readState();state.crmJobs=Array.isArray(jobs)?jobs.slice(0,1000):[];writeState(state);return state.crmJobs;}
function upsertCrmJob(job){const state=readState();const index=state.crmJobs.findIndex(existing=>existing.id===job.id||(job.externalId&&existing.externalId===job.externalId));if(index>=0)state.crmJobs[index]={...state.crmJobs[index],...job};else state.crmJobs.unshift(job);state.crmJobs=state.crmJobs.slice(0,1000);writeState(state);return index>=0?state.crmJobs[index]:state.crmJobs[0];}

module.exports={listInbound,hasExternalId,getInboundByExternalId,addInbound,clearInbound,logEvent,setIntegrationHealth,listSystemState,clearSystemState,listCrmJobs,replaceCrmJobs,upsertCrmJob};
