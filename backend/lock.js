class Lock {
    constructor() {
      this.locks = new Map();
    }
  
    async acquire(resource, timeout = 10000) {
      const startTime = Date.now();
      while (this.locks.has(resource)) {
        if (Date.now() - startTime > timeout) {
          throw new Error('Lock acquisition timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      this.locks.set(resource, true);
    }
  
    release(resource) {
      this.locks.delete(resource);
    }
  
    async withLock(resource, operation) {
      try {
        await this.acquire(resource);
        return await operation();
      } finally {
        this.release(resource);
      }
    }
  }
  
  const lock = new Lock();
  
  module.exports = { lock };