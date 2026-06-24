# CloudBase 数据集合

## trips

- `_id`
- `name`
- `city`
- `dateRange`
- `center`: `{ latitude, longitude }`
- `ownerOpenid`
- `createdAt`
- `updatedAt`

## members

- `_id`
- `tripId`
- `openid`
- `nickName`
- `avatarColor`
- `role`: `owner | member`
- `createdAt`

## places

- `_id`
- `tripId`
- `name`
- `address`
- `latitude`
- `longitude`
- `category`
- `note`
- `status`: `must | want | maybe`
- `createdBy`
- `wantCount`
- `commentCount`
- `createdAt`
- `updatedAt`

## comments

- `_id`
- `tripId`
- `placeId`
- `createdBy`
- `content`
- `createdAt`

## placeReactions

- `_id`
- `tripId`
- `placeId`
- `openid`
- `type`: `want`
- `createdAt`

## routePlans

- `_id`
- `tripId`
- `name`
- `placeIds`
- `updatedBy`
- `createdAt`
- `updatedAt`
