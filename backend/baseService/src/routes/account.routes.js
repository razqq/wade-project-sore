import { Router } from 'express'
import passport from 'passport'
import { getDriver } from '../neo4j.js'
import FavoriteService from '../services/favorite.service.js'
import AccountService from '../services/account.service.js'
import { getPagination, getUserId} from '../utils.js'

const router = new Router()

/**
 * Require jwt authentication for these routes
 */
router.use(passport.authenticate('jwt', { session: false }))

/**
 * @GET /account/
 *
 * This route simply returns the claims made in the JWT token
 */
router.get('/', (req, res, next) => {
    try {
      res.json(req.user)
    }
    catch (e) {
      next(e)
    }
})

/**
 * @GET /account/info
 * 
 * This route should return all the informations about the user
 */
router.get('/info', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)
    console.log("Get info for:",req.body)

    const { sort, order, limit, skip } = getPagination(req)

    const service = new AccountService(driver)
    const favorites = await service.info(userId, sort, order, limit, skip)

    res.json(favorites)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @GET /account/favorites/
 *
 * This route should return a list of artists that a user has added to their favorites
 */
router.get('/favorites', async (req, res, next) => {
    try {
      const driver = getDriver()
      const userId = getUserId(req)
      console.log("Get favorites for:", req.body)
  
      const { sort, order, limit, skip } = getPagination(req)
  
      const service = new FavoriteService(driver)
      const favorites = await service.likes(userId, sort, order, limit, skip)
  
      res.json(favorites)
    }
    catch (e) {
      next(e)
    }
})

/**
 * @GET /account/dislikes
 * 
 * This route should return a list of artists that a user has added to their dislikes
 */
router.get('/dislikes', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)
    console.log("Get disliked for:",req.body)

    const { sort, order, limit, skip } = getPagination(req)

    const service = new FavoriteService(driver)
    const favorites = await service.dislikes(userId, sort, order, limit, skip)

    res.json(favorites)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @GET /account/history
 * 
 * This route should return a list of artists that user interacted with (liked or disliked)
 */
router.get('/history', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)

    const limit = parseInt(req.query.limit || 5)
    const skip = parseInt(req.query.skip || 0)

    console.log("limit:",limit)
    console.log("skip:",skip)
    console.log(req.query)

    const service = new FavoriteService(driver)
    const favorites = await service.history(userId, limit, skip)

    res.json(favorites)
  }
  catch (e) {
    next(e)
  }
})

/**
 * @POST /account/add/job
 * 
 * This route should link a user to a job
 */
router.post('/add/job', async (req, res, next) => {
  try {
    const driver = getDriver()
    const userId = getUserId(req)
    const jobName = req.body.jobName
    console.log("Add job for:",req.body)

    const service = new AccountService(driver)
    const job = await service.addJob(userId, jobName)

    res.json(job)
  }
  catch (e) {
    next(e)
  }
})


  
export default router