  const mongoose = require('mongoose')
const Roles = require('../constants/role')

  const userSchema= new mongoose.Schema({
    username:{type:String, required:true, },
    email:{type:String, required:true, unique:true},
    phone:{type:String,required:true},
    password:{type:String, required:true,},
    role:{type:String, enum:Roles, default:'user'},
    address:{type:String}
  })
  module.exports=mongoose.model('User',userSchema)