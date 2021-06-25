const http = require('http')

let stopped = false;
// SIGINT instead of SIGTERM for convenience
process.on('SIGINT', () => {
  stopped = true;
});

async function aSec() {
  return new Promise(resolve => {
    setTimeout(resolve, 1000);
  });
}

async function getResource(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: path,
      method: 'GET',
    };

    const req = http.request(options, res => {
      res.on('data', d => {
        resolve(d);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
};

let serviceDiscovered = false;

async function discovery() {
  if (stopped) {
    return;
  }
  let health;
  try {
    health = await getResource('/health')
  } catch (e) {
    // Upstream is not healthy.
  }

  if (health && JSON.parse(health)) {
    serviceDiscovered = true;
  } else {
    serviceDiscovered = false;
  }

  setTimeout(discovery, 1000);
}

async function getWork() {
  if (!serviceDiscovered) {
    throw new Error("No work source found");
  }
  try {
    return getResource("/work");
  } catch (e) {
    // errorLogger.logError(e);
  }
  return undefined;
}

(async() => {
  await discovery();
  while(!stopped) {
    try {
      // Fetch data
      const r = await getWork();
      // Print data
      if (r) {
        console.log(r.toString());
      }
      // Throttle 1 second
      await aSec();
    } catch (e) {
      // errorLogger.logError(e);
    }

    // Uncomment to fix deadlock
    //await new Promise(resolve => {
    //  setImmediate(resolve);
    //});
  }
})();
