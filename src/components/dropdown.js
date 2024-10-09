import { Select, Space } from 'antd'
import { Fragment } from 'react'

function AntdDropdown() {
  return (
    <Fragment>
      <Space>
        <Select
          defaultValue="lucy"
          style={{
            width: 120,
          }}
          options={[
            {
              value: 'jack',
              label: 'Jack',
            },
            {
              value: 'lucy',
              label: 'Lucy',
            },
            {
              value: 'Yiminghe',
              label: 'yiminghe',
            },
          ]}
        />
      </Space>
    </Fragment>
  )
}
export default AntdDropdown
