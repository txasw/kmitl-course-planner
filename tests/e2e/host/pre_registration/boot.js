// Starts the replica on the served page and hands its driver to the specs.

import { mountReplica } from '/replica/replica.js';

window.replica = mountReplica(document);
