import { useEffect, useEffectEvent, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { computePositionFifo } from '@actual-app/core/shared/investments';
import { currentDay } from '@actual-app/core/shared/months';
import type {
  InvestmentAssetEntity,
  InvestmentPositionEntity,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { FinancialText } from '#components/FinancialText';
import { border } from '#components/overview/border';
import { rowStyle } from '#components/overview/rowStyle';
import { Stat } from '#components/overview/Stat';
import { Page } from '#components/Page';
import { Field, Row, TableHeader } from '#components/table';
import { useLanguage } from '#hooks/useLocale';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

import { Allocation } from './Allocation';
import { AssetForm } from './AssetForm';
import { AssetSummary } from './AssetSummary';
import { BrokersPanel } from './BrokersPanel';
import { DividendCalendar } from './DividendCalendar';
import { Fire } from './Fire';
import {
  formatMoney,
  formatNumber,
  formatPercent,
  parseDecimal,
  toErrorMessage,
} from './format';
import { ImportPanel } from './ImportPanel';
import { Performance } from './Performance';
import { TradeForm } from './TradeForm';
import { Watchlist } from './Watchlist';
import { XRay } from './XRay';

export const investmentsQueryKey = ['investments'] as const;

type CostMethod = 'average' | 'fifo';

type OpenPanel = 'asset' | 'trade' | 'brokers' | 'import' | null;

const numberField = { textAlign: 'right', justifyContent: 'center' } as const;
const numberCell = { flex: 1, textAlign: 'right' } as const;

function gainColor(value: number | null | undefined) {
  if (!value) {
    return undefined;
  }
  return value > 0 ? theme.noticeTextLight : theme.errorText;
}

type AnalysisTab =
  | 'performance'
  | 'allocation'
  | 'income'
  | 'watchlist'
  | 'fire';

export function Investments() {
  const { t } = useTranslation();
  const language = useLanguage();
  const queryClient = useQueryClient();
  const [defaultCurrencyCode] = useSyncedPref('defaultCurrencyCode');
  const baseCurrency = defaultCurrencyCode || 'EUR';

  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<
    InvestmentAssetEntity['id'] | null
  >(null);
  const [costMethod, setCostMethod] = useState<CostMethod>('average');
  const [editingAsset, setEditingAsset] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualPrice, setManualPrice] = useState('');
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('performance');
  const hasServer = useSyncServerStatus() !== 'no-server';

  const { data: assets = [] } = useQuery({
    queryKey: [...investmentsQueryKey, 'assets'],
    queryFn: () => send('investment-assets-get'),
  });
  const { data: positions = [] } = useQuery({
    queryKey: [...investmentsQueryKey, 'positions', baseCurrency],
    queryFn: () => send('investment-positions-get', { baseCurrency }),
  });
  const { data: trades = [] } = useQuery({
    queryKey: [...investmentsQueryKey, 'trades', selectedAssetId],
    queryFn: () =>
      send('investment-trades-get', { assetId: selectedAssetId ?? undefined }),
    enabled: selectedAssetId != null,
  });

  const { data: allTrades = [] } = useQuery({
    queryKey: [...investmentsQueryKey, 'trades', 'all'],
    queryFn: () => send('investment-trades-get', {}),
  });

  const positionsByAsset = new Map<string, InvestmentPositionEntity>(
    positions.map(position => [position.asset.id, position]),
  );
  const selectedAsset = assets.find(asset => asset.id === selectedAssetId);
  const editingTrade = trades.find(trade => trade.id === editingTradeId);

  const valued = positions.filter(
    position => position.base?.marketValue != null,
  );
  const totalValue = valued.reduce(
    (sum, position) => sum + (position.base?.marketValue ?? 0),
    0,
  );
  const totalGain = valued.reduce(
    (sum, position) => sum + (position.base?.unrealizedGain ?? 0),
    0,
  );
  // FIFO realized gain and cost are computed here; assets with trades lacking a rate keep the backend average cost.
  const fifoTotals = positions.reduce(
    (totals, position) => {
      const assetTrades = allTrades.filter(
        trade => trade.asset_id === position.asset.id,
      );
      const rateOf = (trade: { fx_rate: number | null }) =>
        trade.fx_rate ?? (position.asset.currency === baseCurrency ? 1 : null);
      if (
        costMethod === 'average' ||
        assetTrades.some(trade => rateOf(trade) == null)
      ) {
        return {
          realized: totals.realized + (position.base?.realizedGain ?? 0),
          cost: totals.cost + (position.base?.costBasis ?? 0),
        };
      }
      const fifo = computePositionFifo(
        assetTrades,
        trade => rateOf(trade) ?? 1,
      );
      return {
        realized: totals.realized + fifo.realizedGain,
        cost: totals.cost + fifo.costBasis,
      };
    },
    { realized: 0, cost: 0 },
  );
  const totalRealized = fifoTotals.realized;
  const totalIncome = positions.reduce(
    (sum, position) => sum + (position.base?.income ?? 0),
    0,
  );
  const unvalued = positions.filter(
    position => position.quantity !== 0 && position.base?.marketValue == null,
  ).length;

  function reload() {
    void queryClient.invalidateQueries({ queryKey: investmentsQueryKey });
  }

  function onSaved() {
    setMessage(null);
    setOpenPanel(null);
    reload();
  }

  async function onRefreshPrices() {
    setIsRefreshing(true);
    setMessage(null);
    try {
      const result = await send('investment-prices-refresh');
      if (result.errors.length > 0) {
        setMessage(
          result.errors
            .map(error =>
              error.symbol
                ? `${error.symbol}: ${error.message}`
                : error.message,
            )
            .join(' · '),
        );
      }
    } catch (error) {
      setMessage(toErrorMessage(error));
    } finally {
      setIsRefreshing(false);
      reload();
    }
  }

  async function onSavePrice(asset: InvestmentAssetEntity) {
    const price = parseDecimal(manualPrice);
    if (price == null) {
      return;
    }
    await send('investment-price-set', {
      assetId: asset.id,
      date: currentDay(),
      price,
    });
    setManualPrice('');
    reload();
  }

  // Opening the page should show current figures without asking for them
  const refreshOnOpen = useEffectEvent(() => {
    if (hasServer) {
      void onRefreshPrices();
    }
  });
  useEffect(() => {
    refreshOnOpen();
  }, []);

  async function onDeleteAsset(asset: InvestmentAssetEntity) {
    await send('investment-asset-delete', { id: asset.id });
    setSelectedAssetId(null);
    reload();
  }

  async function onDeleteTrade(id: string) {
    await send('investment-trade-delete', { id });
    reload();
  }

  const analysisTabs: { id: AnalysisTab; label: string }[] = [
    { id: 'performance', label: t('Performance') },
    { id: 'allocation', label: t('Allocation and X-Ray') },
    { id: 'income', label: t('Dividends') },
    { id: 'watchlist', label: t('Watchlist') },
    { id: 'fire', label: t('FIRE') },
  ];

  return (
    <Page header={t('Investments')}>
      <View style={{ gap: 28, paddingBottom: 40 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            flexShrink: 0,
            border,
            borderRadius: 8,
            backgroundColor: theme.cardBackground,
          }}
        >
          <Stat
            first
            label={t('Total value')}
            value={formatMoney(totalValue, baseCurrency, language)}
          />
          <Stat
            label={t('Unrealized gain')}
            value={formatMoney(totalGain, baseCurrency, language)}
          />
          <Stat
            label={t('Realized gain')}
            value={formatMoney(totalRealized, baseCurrency, language)}
            note={`${t('Cost basis')}: ${formatMoney(fifoTotals.cost, baseCurrency, language)} · ${t('Income')}: ${formatMoney(totalIncome, baseCurrency, language)}`}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>Cost method</Trans>
          </Text>
          <Select
            value={costMethod}
            onChange={setCostMethod}
            options={[
              ['average', t('Average')],
              ['fifo', t('FIFO')],
            ]}
          />
          <View style={{ flex: 1 }} />
          <Button
            onPress={() => setOpenPanel(openPanel === 'asset' ? null : 'asset')}
          >
            <Trans>Add asset</Trans>
          </Button>
          <Button
            isDisabled={assets.length === 0}
            onPress={() => setOpenPanel(openPanel === 'trade' ? null : 'trade')}
          >
            <Trans>Add trade</Trans>
          </Button>
          <Button
            onPress={() =>
              setOpenPanel(openPanel === 'import' ? null : 'import')
            }
          >
            <Trans>Import file</Trans>
          </Button>
          {hasServer && (
            <Button
              onPress={() =>
                setOpenPanel(openPanel === 'brokers' ? null : 'brokers')
              }
            >
              <Trans>Brokers</Trans>
            </Button>
          )}
          <Button
            variant="primary"
            isDisabled={isRefreshing || assets.length === 0 || !hasServer}
            onPress={onRefreshPrices}
          >
            {isRefreshing ? (
              <Trans>Updating prices…</Trans>
            ) : (
              <Trans>Update prices</Trans>
            )}
          </Button>
        </View>

        {unvalued > 0 && (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Positions left out of the total because they have no price or
              exchange rate yet: {{ count: unvalued }}
            </Trans>
          </Text>
        )}
        {!hasServer && (
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Prices update automatically only with a sync server. Without one,
              select an asset and enter its price by hand.
            </Trans>
          </Text>
        )}
        {message && <Text style={{ color: theme.errorText }}>{message}</Text>}

        {openPanel === 'asset' && (
          <AssetForm
            defaultCurrency={baseCurrency}
            onDone={onSaved}
            onError={setMessage}
          />
        )}
        {editingAsset && selectedAsset && (
          <AssetForm
            asset={selectedAsset}
            defaultCurrency={baseCurrency}
            onDone={() => {
              setEditingAsset(false);
              onSaved();
            }}
            onError={setMessage}
          />
        )}
        {editingTrade && (
          <TradeForm
            key={editingTrade.id}
            trade={editingTrade}
            assets={assets}
            onDone={() => {
              setEditingTradeId(null);
              onSaved();
            }}
            onError={setMessage}
          />
        )}
        {openPanel === 'brokers' && <BrokersPanel onImported={reload} />}
        {openPanel === 'import' && (
          <ImportPanel defaultCurrency={baseCurrency} onImported={reload} />
        )}
        {openPanel === 'trade' && (
          <TradeForm assets={assets} onDone={onSaved} onError={setMessage} />
        )}

        {assets.length === 0 ? (
          <Text style={{ fontSize: '1.1rem' }}>
            <Trans>
              No assets yet. Add the funds, shares or coins you hold, then
              record your trades.
            </Trans>
          </Text>
        ) : (
          <View
            style={{
              border,
              borderRadius: 8,
              backgroundColor: theme.cardBackground,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <View
              style={{
                ...rowStyle,
                color: theme.pageTextSubdued,
                fontSize: 12,
              }}
            >
              <Text style={{ flex: 2 }}>
                <Trans>Asset</Trans>
              </Text>
              <Text style={numberCell}>
                <Trans>Quantity</Trans>
              </Text>
              <Text style={numberCell}>
                <Trans>Average cost</Trans>
              </Text>
              <Text style={numberCell}>
                <Trans>Price</Trans>
              </Text>
              <Text style={numberCell}>
                <Trans>Value</Trans>
              </Text>
              <Text style={numberCell}>
                <Trans>Unrealized gain</Trans>
              </Text>
            </View>
            {assets.map(asset => {
              const position = positionsByAsset.get(asset.id);
              const isSelected = asset.id === selectedAssetId;
              return (
                <View
                  key={asset.id}
                  role="button"
                  tabIndex={0}
                  style={{
                    ...rowStyle,
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? theme.tableRowBackgroundHover
                      : undefined,
                  }}
                  onClick={() =>
                    setSelectedAssetId(isSelected ? null : asset.id)
                  }
                >
                  <View style={{ flex: 2 }}>
                    <Text style={{ fontWeight: 500 }}>{asset.name}</Text>
                    <Text style={{ color: theme.pageTextSubdued }}>
                      {asset.symbol}
                    </Text>
                  </View>
                  <FinancialText style={numberCell}>
                    {formatNumber(position?.quantity ?? 0, language)}
                  </FinancialText>
                  <FinancialText style={numberCell}>
                    {formatMoney(
                      position?.averageCost,
                      asset.currency,
                      language,
                    )}
                  </FinancialText>
                  <View style={{ ...numberCell, alignItems: 'flex-end' }}>
                    <FinancialText>
                      {formatMoney(position?.price, asset.currency, language)}
                    </FinancialText>
                    <Text
                      style={{ fontSize: 11, color: theme.pageTextSubdued }}
                    >
                      {position?.priceDate ?? ''}
                    </Text>
                  </View>
                  <FinancialText style={numberCell}>
                    {formatMoney(
                      position?.marketValue,
                      asset.currency,
                      language,
                    )}
                  </FinancialText>
                  <FinancialText
                    style={{
                      ...numberCell,
                      color: gainColor(position?.unrealizedGain),
                    }}
                  >
                    {formatMoney(
                      position?.unrealizedGain,
                      asset.currency,
                      language,
                    )}{' '}
                    {formatPercent(
                      position?.unrealizedGainPercent ?? null,
                      language,
                    )}
                  </FinancialText>
                </View>
              );
            })}
          </View>
        )}

        {selectedAsset && (
          <View style={{ gap: 8 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Text style={{ fontSize: 16, fontWeight: 600 }}>
                <Trans>Trades of {{ symbol: selectedAsset.symbol }}</Trans>
              </Text>
              <View style={{ flex: 1 }} />
              <Input
                value={manualPrice}
                onChangeValue={setManualPrice}
                placeholder={t('Price today')}
                style={{ width: 120 }}
              />
              <Button
                isDisabled={parseDecimal(manualPrice) == null}
                onPress={() => onSavePrice(selectedAsset)}
              >
                <Trans>Save price</Trans>
              </Button>
              <Button onPress={() => setEditingAsset(value => !value)}>
                <Trans>Edit asset</Trans>
              </Button>
              <Button onPress={() => onDeleteAsset(selectedAsset)}>
                <Trans>Delete asset and its trades</Trans>
              </Button>
            </View>
            {positionsByAsset.get(selectedAsset.id) && (
              <AssetSummary
                position={positionsByAsset.get(selectedAsset.id)!}
                language={language}
              />
            )}
            {trades.length === 0 ? (
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>No trades yet.</Trans>
              </Text>
            ) : (
              <View>
                <TableHeader>
                  <Field width={110}>
                    <Trans>Date</Trans>
                  </Field>
                  <Field width={100}>
                    <Trans>Type</Trans>
                  </Field>
                  <Field width="flex" style={numberField}>
                    <Trans>Quantity</Trans>
                  </Field>
                  <Field width={130} style={numberField}>
                    <Trans>Price per unit</Trans>
                  </Field>
                  <Field width={110} style={numberField}>
                    <Trans>Fee</Trans>
                  </Field>
                  <Field width={150} />
                </TableHeader>
                {trades.map(trade => (
                  <Row
                    key={trade.id}
                    style={{ backgroundColor: theme.tableBackground }}
                  >
                    <Field width={110}>{trade.date}</Field>
                    <Field width={100}>
                      {
                        {
                          buy: t('Buy'),
                          sell: t('Sell'),
                          dividend: t('Dividend'),
                          fee: t('Fee'),
                        }[trade.type]
                      }
                    </Field>
                    <Field width="flex" style={numberField}>
                      <FinancialText>
                        {formatNumber(trade.quantity, language)}
                      </FinancialText>
                    </Field>
                    <Field width={130} style={numberField}>
                      <FinancialText>
                        {formatMoney(
                          trade.price,
                          selectedAsset.currency,
                          language,
                        )}
                      </FinancialText>
                    </Field>
                    <Field width={110} style={numberField}>
                      <FinancialText>
                        {formatMoney(
                          trade.fee,
                          selectedAsset.currency,
                          language,
                        )}
                      </FinancialText>
                    </Field>
                    <Field width={150}>
                      <Button
                        variant="bare"
                        onPress={() => setEditingTradeId(trade.id)}
                      >
                        <Trans>Edit</Trans>
                      </Button>
                      <Button
                        variant="bare"
                        onPress={() => onDeleteTrade(trade.id)}
                      >
                        <Trans>Delete</Trans>
                      </Button>
                    </Field>
                  </Row>
                ))}
              </View>
            )}
          </View>
        )}
        {assets.length > 0 && (
          <View style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 4,
                flexWrap: 'wrap',
                borderBottom: border,
              }}
            >
              {analysisTabs.map(tab => (
                <Button
                  key={tab.id}
                  variant="bare"
                  onPress={() => setAnalysisTab(tab.id)}
                  style={{
                    borderRadius: 0,
                    padding: '8px 12px',
                    fontWeight: analysisTab === tab.id ? 600 : 400,
                    color:
                      analysisTab === tab.id
                        ? theme.pageText
                        : theme.pageTextSubdued,
                    borderBottom:
                      analysisTab === tab.id
                        ? '2px solid ' + theme.pageText
                        : '2px solid transparent',
                  }}
                >
                  {tab.label}
                </Button>
              ))}
            </View>
            {analysisTab === 'performance' && assets.length > 0 && (
              <Performance
                benchmarks={assets
                  .filter(asset => asset.watched)
                  .map(asset => ({ id: asset.id, name: asset.symbol }))}
                baseCurrency={baseCurrency}
                language={language}
              />
            )}
            {analysisTab === 'allocation' && (
              <>
                {assets.length > 0 && (
                  <Allocation positions={positions} language={language} />
                )}
                <XRay positions={positions} />
              </>
            )}
            {analysisTab === 'income' && (
              <DividendCalendar
                trades={allTrades}
                activeAssetIds={
                  new Set(
                    positions
                      .filter(position => position.quantity > 0)
                      .map(position => position.asset.id),
                  )
                }
                baseCurrency={baseCurrency}
                language={language}
              />
            )}
            {analysisTab === 'watchlist' && (
              <Watchlist
                positions={positions}
                defaultCurrency={baseCurrency}
                language={language}
                onChanged={reload}
                onError={setMessage}
              />
            )}
            {analysisTab === 'fire' && (
              <Fire
                baseCurrency={baseCurrency}
                language={language}
                portfolio={positions.reduce(
                  (total, position) =>
                    total + (position.base?.marketValue ?? 0),
                  0,
                )}
              />
            )}
          </View>
        )}
      </View>
    </Page>
  );
}
