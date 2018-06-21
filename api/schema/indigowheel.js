import { GraphQLObjectType, GraphQLList, GraphQLFloat, GraphQLString, GraphQLInt, GraphQLNonNull } from 'graphql'

import IndigoWheel from '@multicycles/indigowheel'

import { VehicleType } from './vehicles'
import { VehicleTypeEnumType, VehicleAttributeEnumType, vehicleInterfaceType } from './vehicleDetailType'
import { ProviderType } from './providers'
import logger from '../logger'
import cache from '../cache'
import { requireAccessToken } from '../auth'

const client = new IndigoWheel({ timeout: process.env.PROVIDER_TIMEOUT || 3000 })

const IndigoWheelType = new GraphQLObjectType({
  name: 'IndigoWheel',
  description: 'A IndigoWheel bike',
  interfaces: () => [VehicleType],
  fields: {
    ...vehicleInterfaceType,
    plate_no: { type: GraphQLString },
    discount: { type: GraphQLInt },
    outside: { type: GraphQLInt }
  }
})

const indigowheel = {
  type: new GraphQLList(IndigoWheelType),
  description: 'Get Indigo Wheel bikes by position',
  args: {
    lat: {
      type: new GraphQLNonNull(GraphQLFloat)
    },
    lng: {
      type: new GraphQLNonNull(GraphQLFloat)
    }
  },
  async resolve(root, { lat, lng }, ctx, info) {
    requireAccessToken(ctx.state.accessToken)

    try {
      const cached = await cache.get(`indigoWheel|${lat}|${lng}`)

      if (cached) {
        return cached
      }

      const result = await client.getBicyclesByLatLng({
        lat,
        lng
      })

      const formatedResult = result.body.data.map(bike => ({
        id: bike.plate_no,
        lat: bike.latitude,
        lng: bike.longitude,
        type: 'BIKE',
        attributes: ['GEARS'],
        provider: IndigoWheel.getProviderDetails(),
        plate_no: bike.plate_no,
        discount: bike.discount,
        outside: bike.outside
      }))

      cache.set(`indigoWheel|${lat}|${lng}`, formatedResult)
      return formatedResult
    } catch (e) {
      logger.exception(e, {
        tags: { provider: 'indigowheel' },
        extra: {
          path: info.path,
          variable: info.variableValues,
          body: ctx.req.body
        }
      })

      return []
    }
  }
}

const provider = IndigoWheel.getProviderDetails()

export { indigowheel, IndigoWheelType, provider }
