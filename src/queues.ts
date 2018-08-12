'use strict';

import * as async from 'async';
import {EVCb, Task} from './index';
import * as nppUtils from './utils';
import log from './logger';

const queues = new Map<string, async.AsyncQueue<Task>>();

export const getQueue = (dir: string): async.AsyncQueue<Task> => {
  
  if (!dir) {
    throw new Error('Empty string passed to ' + getQueue.name);
  }
  
  if (!queues.has(dir)) {
    queues.set(dir, async.queue<Task, any>((task, cb) => task(cb), 1));
  }
  
  return queues.get(dir);
  
};

export type FFirst = (cb: EVCb<any>) => void;

export const getLocks = (locks: Array<string>, cb: FFirst, final: EVCb<any>): void => {
  
  // given a list of directory paths / locks, we get a lock on all
  
  const filtered = nppUtils.getUniqueList(locks);
  
  async.map<string, EVCb<any>, any>(filtered, (v, cb) => {
      
      getQueue(v).push(callback => {
        cb(null, callback);
      });
      
    },
    
    (err, callbacks) => {
      
      if (err) {
        return final(err);
      }
      
      cb((err, result) => {
        
        // always unlock all locks
        callbacks.forEach(v => v(null));
        final(err, result);
        
      });
      
    });
  
};
