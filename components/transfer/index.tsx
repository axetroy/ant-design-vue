import { defineComponent, ExtractPropTypes, ref, watch } from 'vue';
import PropTypes from '../_util/vue-types';
import { getPropsSlot } from '../_util/props-util';
import initDefaultProps from '../_util/props-util/initDefaultProps';
import classNames from '../_util/classNames';
import List from './list';
import Operation from './operation';
import LocaleReceiver from '../locale-provider/LocaleReceiver';
import defaultLocale from '../locale-provider/default';
import { RenderEmptyHandler } from '../config-provider';
import { withInstall } from '../_util/type';
import useConfigInject from '../_util/hooks/useConfigInject';

export type TransferDirection = 'left' | 'right';

export const transferItem = {
  key: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  disabled: PropTypes.looseBool,
};

export const transferProps = {
  prefixCls: PropTypes.string,
  dataSource: PropTypes.arrayOf(PropTypes.shape(transferItem).loose),
  disabled: PropTypes.looseBool,
  targetKeys: PropTypes.arrayOf(PropTypes.string),
  selectedKeys: PropTypes.arrayOf(PropTypes.string),
  render: PropTypes.func,
  listStyle: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  operationStyle: PropTypes.object,
  titles: PropTypes.arrayOf(PropTypes.string),
  operations: PropTypes.arrayOf(PropTypes.string),
  showSearch: PropTypes.looseBool,
  filterOption: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  notFoundContent: PropTypes.any,
  locale: PropTypes.object,
  rowKey: PropTypes.func,
  lazy: PropTypes.oneOfType([PropTypes.object, PropTypes.looseBool]),
  showSelectAll: PropTypes.looseBool,
  selectAllLabels: PropTypes.any,
  children: PropTypes.any,
  oneWay: PropTypes.looseBool,
  pagination: PropTypes.oneOfType([PropTypes.object, PropTypes.looseBool]),
  onChange: PropTypes.func,
  onSelectChange: PropTypes.func,
  onSearchChange: PropTypes.func,
  onSearch: PropTypes.func,
  onScroll: PropTypes.func,
  ['onUpdate:selectedKeys']: PropTypes.func,
  ['onUpdate:targetKeys']: PropTypes.func,
};

export type TransferProps = Partial<ExtractPropTypes<typeof transferProps>>;

export interface TransferLocale {
  titles: any[];
  notFoundContent?: any;
  searchPlaceholder: string;
  itemUnit: string;
  itemsUnit: string;
  remove: string;
  selectAll: string;
  selectCurrent: string;
  selectInvert: string;
  removeAll: string;
  removeCurrent: string;
}

const Transfer = defineComponent({
  name: 'ATransfer',
  inheritAttrs: false,
  props: initDefaultProps(transferProps, {
    dataSource: [],
    locale: {},
    showSearch: false,
    listStyle: () => {},
  }),
  emits: ['update:selectedKeys', 'update:targetKeys', 'change', 'search', 'scroll', 'selectChange'],
  setup(props, { emit, attrs, slots, expose }) {
    const { configProvider, prefixCls, direction } = useConfigInject('transfer', props);
    const sourceSelectedKeys = ref(
      props.selectedKeys?.filter((key) => props.targetKeys.indexOf(key) === -1) ?? [],
    );
    const targetSelectedKeys = ref(
      props.selectedKeys?.filter((key) => props.targetKeys.indexOf(key) > -1) ?? [],
    );

    watch(
      () => props.selectedKeys,
      () => {
        sourceSelectedKeys.value = props.selectedKeys?.filter(
          (key) => props.targetKeys.indexOf(key) === -1,
        );
        targetSelectedKeys.value = props.selectedKeys?.filter(
          (key) => props.targetKeys.indexOf(key) > -1,
        );
      },
    );

    const getTitles = (transferLocale: TransferLocale) => {
      return props?.titles ?? (transferLocale.titles || ['', '']);
    };

    const getLocale = (transferLocale: TransferLocale, renderEmpty: RenderEmptyHandler) => {
      // Keep old locale props still working.
      const oldLocale: { notFoundContent?: any; searchPlaceholder?: string } = {
        notFoundContent: renderEmpty('Transfer'),
      };
      const notFoundContent = getPropsSlot(slots, props, 'notFoundContent');
      if (notFoundContent) {
        oldLocale.notFoundContent = notFoundContent;
      }
      if ('searchPlaceholder' in props) {
        oldLocale.searchPlaceholder = props.searchPlaceholder;
      }

      return { ...transferLocale, ...oldLocale, ...props.locale };
    };

    const moveTo = (direction: TransferDirection) => {
      const { targetKeys = [], dataSource = [] } = props;
      const moveKeys = direction === 'right' ? sourceSelectedKeys.value : targetSelectedKeys.value;
      // filter the disabled options
      const newMoveKeys = moveKeys.filter(
        (key) => !dataSource.some((data) => !!(key === data.key && data.disabled)),
      );
      // move items to target box
      const newTargetKeys =
        direction === 'right'
          ? newMoveKeys.concat(targetKeys)
          : targetKeys.filter((targetKey) => newMoveKeys.indexOf(targetKey) === -1);

      // empty checked keys
      const oppositeDirection = direction === 'right' ? 'left' : 'right';
      direction === 'right' ? (sourceSelectedKeys.value = []) : (targetSelectedKeys.value = []);
      emit('update:targetKeys', newTargetKeys);
      handleSelectChange(oppositeDirection, []);
      emit('change', newTargetKeys, direction, newMoveKeys);
    };

    const moveToLeft = () => {
      moveTo('left');
    };
    const moveToRight = () => {
      moveTo('right');
    };

    const onItemSelectAll = (
      direction: TransferDirection,
      selectedKeys: string[],
      checkAll: boolean,
    ) => {
      const originalSelectedKeys =
        (direction === 'left' ? sourceSelectedKeys.value : targetSelectedKeys.value) || [];

      let mergedCheckedKeys = [];
      if (checkAll) {
        // Merge current keys with origin key
        mergedCheckedKeys = Array.from(new Set([...originalSelectedKeys, ...selectedKeys]));
      } else {
        // Remove current keys from origin keys
        mergedCheckedKeys = originalSelectedKeys.filter((key) => selectedKeys.indexOf(key) === -1);
      }

      handleSelectChange(direction, mergedCheckedKeys);
    };

    const onLeftItemSelectAll = (selectedKeys: string[], checkAll: boolean) => {
      return onItemSelectAll('left', selectedKeys, checkAll);
    };

    const onRightItemSelectAll = (selectedKeys: string[], checkAll: boolean) => {
      return onItemSelectAll('right', selectedKeys, checkAll);
    };

    const handleSelectChange = (direction: TransferDirection, holder: string[]) => {
      if (direction === 'left') {
        sourceSelectedKeys.value = holder;
        emit('update:selectedKeys', [...targetSelectedKeys.value, ...holder]);
        emit('selectChange', holder, targetSelectedKeys);
      } else {
        targetSelectedKeys.value = holder;
        emit('update:selectedKeys', [...sourceSelectedKeys.value, ...holder]);
        emit('selectChange', sourceSelectedKeys, holder);
      }
    };

    const handleFilter = (direction: TransferDirection, e) => {
      const value = e.target.value;
      emit('search', direction, value);
    };

    const handleLeftFilter = (e: Event) => {
      handleFilter('left', e);
    };
    const handleRightFilter = (e: Event) => {
      handleFilter('right', e);
    };

    const handleClear = (direction: TransferDirection) => {
      emit('search', direction, '');
    };

    const handleLeftClear = () => {
      handleClear('left');
    };

    const handleRightClear = () => {
      handleClear('right');
    };

    const onItemSelect = (direction: TransferDirection, selectedKey: string, checked: boolean) => {
      const holder =
        direction === 'left' ? [...sourceSelectedKeys.value] : [...targetSelectedKeys.value];
      const index = holder.indexOf(selectedKey);
      if (index > -1) {
        holder.splice(index, 1);
      }
      if (checked) {
        holder.push(selectedKey);
      }
      handleSelectChange(direction, holder);
    };

    const onLeftItemSelect = (selectedKey: string, checked: boolean) => {
      return onItemSelect('left', selectedKey, checked);
    };
    const onRightItemSelect = (selectedKey: string, checked: boolean) => {
      return onItemSelect('right', selectedKey, checked);
    };
    const onRightItemRemove = (targetedKeys: string[]) => {
      const { targetKeys = [] } = props;
      const newTargetKeys = targetKeys.filter((key) => !targetedKeys.includes(key));
      emit('update:targetKeys', newTargetKeys);
      emit('change', newTargetKeys, 'left', [...targetedKeys]);
    };

    const handleScroll = (direction: TransferDirection, e: Event) => {
      emit('scroll', direction, e);
    };

    const handleLeftScroll = (e: Event) => {
      handleScroll('left', e);
    };
    const handleRightScroll = (e: Event) => {
      handleScroll('right', e);
    };
    const handleListStyle = (listStyle, direction) => {
      if (typeof listStyle === 'function') {
        return listStyle({ direction });
      }
      return listStyle;
    };

    const separateDataSource = () => {
      const { dataSource, rowKey, targetKeys = [] } = props;

      const leftDataSource = [];
      const rightDataSource = new Array(targetKeys.length);
      dataSource.forEach((record) => {
        if (rowKey) {
          record.key = rowKey(record);
        }

        // rightDataSource should be ordered by targetKeys
        // leftDataSource should be ordered by dataSource
        const indexOfKey = targetKeys.indexOf(record.key);
        if (indexOfKey !== -1) {
          rightDataSource[indexOfKey] = record;
        } else {
          leftDataSource.push(record);
        }
      });

      return {
        leftDataSource,
        rightDataSource,
      };
    };

    expose({ handleSelectChange });

    const renderTransfer = (transferLocale: TransferLocale) => {
      const {
        disabled,
        operations = [],
        showSearch,
        listStyle,
        operationStyle,
        filterOption,
        lazy,
        showSelectAll,
        selectAllLabels = [],
        oneWay,
        pagination,
      } = props;
      const { class: className, style } = attrs;

      const children = slots.children;
      const mergedPagination = !children && pagination;

      const renderEmpty = configProvider.renderEmpty;
      const locale = getLocale(transferLocale, renderEmpty);
      const { body, footer } = slots;
      const renderItem = props.render || slots.render;
      const { leftDataSource, rightDataSource } = separateDataSource();
      const leftActive = targetSelectedKeys.value.length > 0;
      const rightActive = sourceSelectedKeys.value.length > 0;

      const cls = classNames(prefixCls.value, className, {
        [`${prefixCls.value}-disabled`]: disabled,
        [`${prefixCls.value}-customize-list`]: !!children,
      });
      const titles = getTitles(locale);

      return (
        <div class={cls} style={style}>
          <List
            key="leftList"
            prefixCls={`${prefixCls.value}-list`}
            titleText={titles[0]}
            dataSource={leftDataSource}
            filterOption={filterOption}
            style={handleListStyle(listStyle, 'left')}
            checkedKeys={sourceSelectedKeys.value}
            handleFilter={handleLeftFilter}
            handleClear={handleLeftClear}
            onItemSelect={onLeftItemSelect}
            onItemSelectAll={onLeftItemSelectAll}
            renderItem={renderItem}
            showSearch={showSearch}
            body={body}
            renderList={children}
            footer={footer}
            lazy={lazy}
            onScroll={handleLeftScroll}
            disabled={disabled}
            direction="left"
            showSelectAll={showSelectAll}
            selectAllLabel={selectAllLabels[0]}
            pagination={mergedPagination}
            {...locale}
          />
          <Operation
            key="operation"
            class={`${prefixCls.value}-operation`}
            rightActive={rightActive}
            rightArrowText={operations[0]}
            moveToRight={moveToRight}
            leftActive={leftActive}
            leftArrowText={operations[1]}
            moveToLeft={moveToLeft}
            style={operationStyle}
            disabled={disabled}
            direction={direction.value}
            oneWay={oneWay}
          />
          <List
            key="rightList"
            prefixCls={`${prefixCls.value}-list`}
            titleText={titles[1]}
            dataSource={rightDataSource}
            filterOption={filterOption}
            style={handleListStyle(listStyle, 'right')}
            checkedKeys={targetSelectedKeys.value}
            handleFilter={handleRightFilter}
            handleClear={handleRightClear}
            onItemSelect={onRightItemSelect}
            onItemSelectAll={onRightItemSelectAll}
            onItemRemove={onRightItemRemove}
            renderItem={renderItem}
            showSearch={showSearch}
            body={body}
            renderList={children}
            footer={footer}
            lazy={lazy}
            onScroll={handleRightScroll}
            disabled={disabled}
            direction="right"
            showSelectAll={showSelectAll}
            showRemove={oneWay}
            pagination={mergedPagination}
            {...locale}
          />
        </div>
      );
    };
    return () => (
      <LocaleReceiver
        componentName="Transfer"
        defaultLocale={defaultLocale.Transfer}
        children={renderTransfer}
      />
    );
  },
});

export default withInstall(Transfer);
