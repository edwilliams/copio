import { expect } from '@esm-bundle/chai';
import { randomId } from '../js/utils/utils.js';

describe('utils.js', () => {
  it('randomId should return a 32 character hex string', () => {
    const id = randomId();
    expect(id).to.be.a('string');
    expect(id).to.have.lengthOf(32);
    expect(/^[0-9a-f]{32}$/.test(id)).to.be.true;
  });

  it('randomId should return unique values', () => {
    const id1 = randomId();
    const id2 = randomId();
    expect(id1).to.not.equal(id2);
  });
});
