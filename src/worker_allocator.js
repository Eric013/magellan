"use strict";

var _ = require("lodash");
var clc = require("cli-color");
var settings = require("./settings");
var portUtil = require("./util/port_util");
var checkPorts = portUtil.checkPorts;
var getNextPort = portUtil.getNextPort;

var MAX_ALLOCATION_ATTEMPTS = 120;
var WORKER_START_DELAY = 1000;

// Create a worker allocator for MAX_WORKERS workers. Note that the allocator
// is not obliged to honor the creation of MAX_WORKERS, just some number of workers
// between 0 and MAX_WORKERS.
function Allocator(options) {
  if (settings.debug) {
    console.log("Worker Allocator starting.");
    console.log("Port allocation range from: " + settings.BASE_PORT_START + " to "
      + (settings.BASE_PORT_START + settings.BASE_PORT_RANGE - 1) + " with "
      + settings.BASE_PORT_SPACING + " ports available to each worker.");
  }
  
  this.extension = options.extension;
  this.initializeWorkers(options.workers);
}

Allocator.prototype = {

  initialize: function (callback) {
    this.extension.initialize(callback);
    // callback();
  },

  teardown: function (callback) {
    this.extension.teardown(callback);
    // callback();
  },

  initializeWorkers: function (numWorkers) {
    this.workers = [];

    for (var i = 1; i < numWorkers + 1; i++) {
      this.workers.push({
        index: i,
        occupied: false,
        portOffset: undefined
      });
    }
  },

  get: function (callback) {
    var attempts = 0;

    // Poll the worker allocator until we have a known-good port, then run this test
    var poll = function () {
      this._get(function (worker) {
        attempts++;
        if (worker) {
          return callback(null, worker);
        } else if (attempts > MAX_ALLOCATION_ATTEMPTS) {
          var errorMessage = "Couldn't allocate a worker after " + MAX_ALLOCATION_ATTEMPTS
            + " attempts";
          return callback(errorMessage);
        } else {
          // If we didn't get a worker, try again
          setTimeout(poll, WORKER_START_DELAY);
        }
      }.bind(this));
    }.bind(this);

    setTimeout(poll, WORKER_START_DELAY);
  },

  _get: function (callback) {
    var availableWorker = _.find(this.workers, function (e) {
      return !e.occupied;
    });

    if (availableWorker) {
      // occupy this worker while we test if we can use it
      availableWorker.occupied = true;

      var portOffset = getNextPort();

      // Standard Magellan convention: port = mock, port + 1 = selenium
      // Other ports after this within the BASE_PORT_SPACING range can
      // be used for whatever the user desires, so those are labelled
      // as "generic" (if found to be occupied, that is).
      var desiredPortLabels = ["mocking port", "selenium port"];
      var desiredPorts = [];

      // if BASE_PORT_SPACING is the default of 3, we'll check 3 ports
      for (var i = 0; i < settings.BASE_PORT_SPACING; i++) {
        desiredPorts.push(portOffset + i);
      }

      checkPorts(desiredPorts, function (statuses) {
        if (_.every(statuses, function (status) { return status.available; })) {
          availableWorker.portOffset = portOffset;
          availableWorker.occupied = true;

          return callback(availableWorker);
        } else {
          // Print a message that ports are not available, show which ones in the range
          availableWorker.occupied = false;

          console.log(clc.yellowBright("Detected port contention while spinning up worker: "));
          statuses.forEach(function (status, portIndex) {
            if (!status.available) {
              console.log(clc.yellowBright("  in use: #: " + status.port + " purpose: "
                + (desiredPortLabels[portIndex] ? desiredPortLabels[portIndex] : "generic")));
            }
          });

          return callback(undefined);
        }
      });
    } else {
      return callback(undefined);
    }
  },

  release: function (worker) {
    this.extension.release(worker);
    worker.occupied = false;
  }

};

module.exports = Allocator;
