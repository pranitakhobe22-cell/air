const BaseModel = require('./BaseModel');

class Profile extends BaseModel {
    constructor() {
        super('user_profiles');
    }
}

module.exports = new Profile();
