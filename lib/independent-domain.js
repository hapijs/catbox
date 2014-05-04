
var internals = {
  domain: undefined
};

// Executes `exec` in an independent domain from any existing domains. This allows us to have
// long running callbacks that are independent of the current domain.
module.exports.run = function(exec) {

  if (process.domain) {
    // Avoid requiring the child domain unless we need it as there are side effects for processes
    // that have not otherwise required it.
    internals.domain = internals.domain || require('domain').create();

    return internals.domain.run(exec);
  } else {
    return exec();
  }
};
