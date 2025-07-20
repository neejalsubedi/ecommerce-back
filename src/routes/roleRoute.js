const Role = require('../constants/role')
const express =require('express')
const router=express.Router()

router.get('/role',async(req,res)=>{
  try {
    const roleList = Object.entries(Role).map(([key, value]) => ({
      key,
      value,
    }));

    res.json({ roles: roleList });
  } catch (error) {
    res.status(400).json({ message: "Failed to fetch roles", error });
  }
})

module.exports=router