import React, { Fragment } from 'react'
import { Cascader } from 'antd'

function AntdCascader({ data, onChange, defaultValue }) {
  return (
    <Fragment>
      <Cascader
        defaultValue={defaultValue}
        options={data}
        onChange={onChange}
        placeholder="Please select"
      />
    </Fragment>
  )
}

export default AntdCascader
