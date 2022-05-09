'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');


const { before, describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('import()', () => {

    let Catbox;

    before(async () => {

        Catbox = await import('../lib/index.js');
    });

    it('exposes all methods and classes as named imports', () => {

        expect(Object.keys(Catbox)).to.equal([
            'Client',
            'Policy',
            'default',
            'policy'
        ]);
    });
});
