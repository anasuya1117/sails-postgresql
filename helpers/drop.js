//  ██████╗ ██████╗  ██████╗ ██████╗
//  ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
//  ██║  ██║██████╔╝██║   ██║██████╔╝
//  ██║  ██║██╔══██╗██║   ██║██╔═══╝
//  ██████╔╝██║  ██║╚██████╔╝██║
//  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝
//

module.exports = require('machine').build({


  friendlyName: 'Drop',


  description: 'Remove a table from the database.',


  inputs: {

    datastore: {
      description: 'The datastore to use for connections.',
      extendedDescription: 'Datastores represent the config and manager required to obtain an active database connection.',
      required: true,
      example: '==='
    },

    tableName: {
      description: 'The name of the table to destroy.',
      required: true,
      example: 'users'
    },

    meta: {
      friendlyName: 'Meta (custom)',
      description: 'Additional stuff to pass to the driver.',
      extendedDescription: 'This is reserved for custom driver-specific extensions.',
      example: '==='
    }

  },


  exits: {

    success: {
      description: 'The table was destroyed successfully.'
    },

    badConnection: {
      friendlyName: 'Bad connection',
      description: 'A connection either could not be obtained or there was an error using the connection.'
    }

  },


  fn: function drop(inputs, exits) {
    var PG = require('machinepack-postgresql');
    var Helpers = require('./private');


    //  ╔═╗╦ ╦╔═╗╔═╗╦╔═  ┌─┐┌─┐┬─┐  ┌─┐  ┌─┐┌─┐  ┌─┐┌─┐┬ ┬┌─┐┌┬┐┌─┐
    //  ║  ╠═╣║╣ ║  ╠╩╗  ├┤ │ │├┬┘  ├─┤  ├─┘│ ┬  └─┐│  ├─┤├┤ │││├─┤
    //  ╚═╝╩ ╩╚═╝╚═╝╩ ╩  └  └─┘┴└─  ┴ ┴  ┴  └─┘  └─┘└─┘┴ ┴└─┘┴ ┴┴ ┴
    // This is a unique feature of Postgres. It may be passed in on a query
    // by query basis using the meta input or configured on the datastore. Default
    // to use the public schema.
    var schemaName = 'public';
    if (inputs.meta && inputs.meta.schema) {
      schemaName = inputs.meta.schema;
    } else if (inputs.datastore.config && inputs.datastore.config.schema) {
      schemaName = inputs.datastore.config.schema;
    }


    //  ╔═╗╔═╗╔═╗╦ ╦╔╗╔  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  ╚═╗╠═╝╠═╣║║║║║║  │  │ │││││││├┤ │   │ ││ ││││
    //  ╚═╝╩  ╩ ╩╚╩╝╝╚╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    var spawnConnection = function spawnConnection(done) {
      Helpers.spawnConnection({
        datastore: inputs.datastore
      })
      .exec({
        error: function error(err) {
          return done(new Error('There was an error spawning a connection from the pool.' + err.stack));
        },
        success: function success(connection) {
          return done(null, connection);
        }
      });
    };


    //  ╦═╗╦ ╦╔╗╔  ┌┐┌┌─┐┌┬┐┬┬  ┬┌─┐  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
    //  ╠╦╝║ ║║║║  │││├─┤ │ │└┐┌┘├┤   │─┼┐│ │├┤ ├┬┘└┬┘
    //  ╩╚═╚═╝╝╚╝  ┘└┘┴ ┴ ┴ ┴ └┘ └─┘  └─┘└└─┘└─┘┴└─ ┴
    var runNativeQuery = function runNativeQuery(connection, query, done) {
      PG.sendNativeQuery({
        connection: connection,
        nativeQuery: query
      })
      .exec(function execCb(err, report) {
        if (err) {
          return done(new Error('There was an error running the native query for drop. The query was: \n\n' + query + '\n\n' + err.stack));
        }

        return done(null, report.result.rows);
      });
    };


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐  ┌┐┌┌─┐┌┬┐┌─┐
    //  ║╣ ╚═╗║  ╠═╣╠═╝║╣    │ ├─┤├┴┐│  ├┤   │││├─┤│││├┤
    //  ╚═╝╚═╝╚═╝╩ ╩╩  ╚═╝   ┴ ┴ ┴└─┘┴─┘└─┘  ┘└┘┴ ┴┴ ┴└─┘
    // Ensure the name is escaped in quotes.
    var escapeName = function escapeName(name, schema) {
      name = '"' + name + '"';
      if (schema) {
        name = '"' + schema + '".' + name;
      }

      return name;
    };


    //  ╦═╗╔═╗╦  ╔═╗╔═╗╔═╗╔═╗  ┌─┐┌─┐┌┐┌┌┐┌┌─┐┌─┐┌┬┐┬┌─┐┌┐┌
    //  ╠╦╝║╣ ║  ║╣ ╠═╣╚═╗║╣   │  │ │││││││├┤ │   │ ││ ││││
    //  ╩╚═╚═╝╩═╝╚═╝╩ ╩╚═╝╚═╝  └─┘└─┘┘└┘┘└┘└─┘└─┘ ┴ ┴└─┘┘└┘
    var releaseConnection = function releaseConnection(connection, done) {
      PG.releaseConnection({
        connection: connection
      }).exec({
        error: function error(err) {
          return done(new Error('There was an error releasing the connection back into the pool.' + err.stack));
        },
        badConnection: function badConnection() {
          return done(new Error('Bad connection when trying to release an active connection.'));
        },
        success: function success() {
          return done();
        }
      });
    };


    //  ╔╦╗╦═╗╔═╗╔═╗  ┌┬┐┬ ┬┌─┐  ┌┬┐┌─┐┌┐ ┬  ┌─┐
    //   ║║╠╦╝║ ║╠═╝   │ ├─┤├┤    │ ├─┤├┴┐│  ├┤
    //  ═╩╝╩╚═╚═╝╩     ┴ ┴ ┴└─┘   ┴ ┴ ┴└─┘┴─┘└─┘
    spawnConnection(function cb(err, connection) {
      if (err) {
        return exits.badConnection(err);
      }

      // Escape Table Name
      var tableName = escapeName(inputs.tableName, schemaName);

      // Build Query
      var query = 'DROP TABLE IF EXISTS' + tableName + ';';

      // Run the DROP TABLE query
      runNativeQuery(connection, query, function cb(err) {
        if (err) {
          releaseConnection(connection, function cb() {
            return exits.error(err);
          });
          return;
        }

        // Release the connection back to the pool
        releaseConnection(connection, function cb(err) {
          if (err) {
            return exits.error(err);
          }

          return exits.success();
        });
      });
    });
  }

});
