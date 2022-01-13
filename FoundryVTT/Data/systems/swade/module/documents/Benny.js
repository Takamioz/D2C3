export default class Benny extends DiceTerm {
    constructor(termData) {
        termData.faces = 2;
        super(termData);
    }
}
/** @override */
Benny.DENOMINATION = 'b';
