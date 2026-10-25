import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Ingredient {
  item: string;
  quantityPerServing: number;
  unit: string;
  costPerKg: number;
}

interface Recipe {
  id: string;
  name: string;
  servingUnit: string;
  baseServings: number;
  ingredients: Ingredient[];
  defaultPrice: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  onRecipeApplied?: (recipeName: string, servings: number) => void;
}

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 20;

export default function RecipeModal({
  visible,
  onClose,
  apiBaseUrl,
  onRecipeApplied,
}: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(1);

  const [applying, setApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/vendor/recipes`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: Recipe[] = await res.json();
      setRecipes(data);
      if (data.length > 0) {
        setSelectedRecipe(data[0]);
        setServings(data[0].baseServings);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load recipes.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (visible) {
      setSuccessMessage(null);
      setApplyError(null);
      fetchRecipes();
    }
  }, [visible, fetchRecipes]);

  const handleSelectRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setServings(recipe.baseServings);
    setSuccessMessage(null);
    setApplyError(null);
  };

  const handleDecrease = () => {
    setServings((s) => Math.max(MIN_SERVINGS, s - 1));
  };

  const handleIncrease = () => {
    setServings((s) => Math.min(MAX_SERVINGS, s + 1));
  };

  const calcCostPerServing = (recipe: Recipe): number => {
    return recipe.ingredients.reduce((sum, ing) => {
      return sum + ing.quantityPerServing * (ing.costPerKg / 1000);
    }, 0);
  };

  const handleApply = async () => {
    if (!selectedRecipe) return;

    setApplying(true);
    setApplyError(null);
    setSuccessMessage(null);

    const payload = {
      recipeId: selectedRecipe.id,
      servings,
      recipeName: selectedRecipe.name,
      ingredients: selectedRecipe.ingredients.map((ing) => ({
        item: ing.item,
        totalQuantity: ing.quantityPerServing * servings,
        unit: ing.unit,
      })),
    };

    try {
      const res = await fetch(`${apiBaseUrl}/vendor/recipes/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      setSuccessMessage(
        `✓ Deducted stock for ${servings} ${selectedRecipe.servingUnit}(s) of ${selectedRecipe.name}`
      );
      onRecipeApplied?.(selectedRecipe.name, servings);
    } catch (e: any) {
      // Show local preview anyway
      setApplyError(
        `API failed: ${e?.message ?? 'Unknown error'}. Local deduction preview shown below.`
      );
    } finally {
      setApplying(false);
    }
  };

  const renderIngredientRow = (ing: Ingredient, servingCount: number, index: number) => {
    const totalQty = (ing.quantityPerServing * servingCount).toFixed(2);
    return (
      <View key={index} style={styles.ingredientRow}>
        <View style={styles.ingredientDot} />
        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientName}>{ing.item}</Text>
          <Text style={styles.ingredientQtyBase}>
            {ing.quantityPerServing} {ing.unit} / serving
          </Text>
        </View>
        <Text style={styles.ingredientTotalQty}>
          {totalQty} {ing.unit}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="restaurant" size={20} color="#073B3A" />
          </View>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Recipes</Text>
            <Text style={styles.headerSubtitle}>& Stock Deduction</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#073B3A" />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        ) : error && recipes.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchRecipes}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Recipe Tab Strip */}
            {recipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="restaurant-outline" size={56} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No recipes found</Text>
                <Text style={styles.emptySubtitle}>
                  Add recipes through your vendor dashboard
                </Text>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabStrip}
                >
                  {recipes.map((recipe) => {
                    const isActive = selectedRecipe?.id === recipe.id;
                    return (
                      <TouchableOpacity
                        key={recipe.id}
                        style={[styles.recipeTab, isActive && styles.recipeTabActive]}
                        onPress={() => handleSelectRecipe(recipe)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.recipeTabText,
                            isActive && styles.recipeTabTextActive,
                          ]}
                        >
                          {recipe.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Selected Recipe Detail Card */}
                {selectedRecipe && (
                  <View style={styles.recipeCard}>
                    {/* Recipe Title */}
                    <View style={styles.recipeCardHeader}>
                      <View>
                        <Text style={styles.recipeCardName}>{selectedRecipe.name}</Text>
                        <Text style={styles.recipeCardUnit}>
                          per {selectedRecipe.servingUnit}
                        </Text>
                      </View>
                      <View style={styles.priceTag}>
                        <Text style={styles.priceTagText}>
                          ₹{selectedRecipe.defaultPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.priceTagLabel}>default</Text>
                      </View>
                    </View>

                    {/* Ingredients */}
                    <View style={styles.ingredientsSection}>
                      <Text style={styles.sectionLabel}>Ingredients</Text>
                      {selectedRecipe.ingredients.map((ing, i) =>
                        renderIngredientRow(ing, 1, i)
                      )}
                    </View>

                    {/* Portion Slider */}
                    <View style={styles.portionSection}>
                      <Text style={styles.sectionLabel}>Serving Count</Text>
                      <View style={styles.portionControls}>
                        <TouchableOpacity
                          style={[
                            styles.portionBtn,
                            servings <= MIN_SERVINGS && styles.portionBtnDisabled,
                          ]}
                          onPress={handleDecrease}
                          disabled={servings <= MIN_SERVINGS}
                        >
                          <Ionicons name="remove" size={20} color="#E2FD52" />
                        </TouchableOpacity>
                        <View style={styles.portionCountContainer}>
                          <Text style={styles.portionCount}>{servings}</Text>
                          <Text style={styles.portionCountLabel}>
                            {selectedRecipe.servingUnit}
                            {servings !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.portionBtn,
                            servings >= MAX_SERVINGS && styles.portionBtnDisabled,
                          ]}
                          onPress={handleIncrease}
                          disabled={servings >= MAX_SERVINGS}
                        >
                          <Ionicons name="add" size={20} color="#E2FD52" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* After Deduction Preview */}
                    <View style={styles.deductionPreview}>
                      <View style={styles.deductionPreviewHeader}>
                        <Ionicons name="arrow-down-circle" size={16} color="#E2FD52" />
                        <Text style={styles.deductionPreviewTitle}>
                          After Deduction ({servings} {selectedRecipe.servingUnit}
                          {servings !== 1 ? 's' : ''})
                        </Text>
                      </View>
                      {selectedRecipe.ingredients.map((ing, i) =>
                        renderIngredientRow(ing, servings, i)
                      )}
                    </View>

                    {/* Cost Preview */}
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Cost per serving</Text>
                      <Text style={styles.costValue}>
                        ₹{calcCostPerServing(selectedRecipe).toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Total cost ({servings} servings)</Text>
                      <Text style={styles.costValueBig}>
                        ₹{(calcCostPerServing(selectedRecipe) * servings).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Success Banner */}
                {successMessage ? (
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={18} color="#059669" />
                    <Text style={styles.successBannerText}>{successMessage}</Text>
                  </View>
                ) : null}

                {/* API Error Note */}
                {applyError ? (
                  <View style={styles.applyErrorBanner}>
                    <Ionicons name="warning" size={16} color="#B45309" />
                    <Text style={styles.applyErrorText}>{applyError}</Text>
                  </View>
                ) : null}

                {/* Apply Button */}
                {selectedRecipe && (
                  <TouchableOpacity
                    style={[
                      styles.applyBtn,
                      applying && styles.applyBtnDisabled,
                    ]}
                    onPress={handleApply}
                    disabled={applying}
                    activeOpacity={0.8}
                  >
                    {applying ? (
                      <ActivityIndicator size="small" color="#073B3A" />
                    ) : (
                      <>
                        <Ionicons name="cut" size={18} color="#073B3A" />
                        <Text style={styles.applyBtnText}>
                          Apply Deduction for {servings}{' '}
                          {selectedRecipe.servingUnit}
                          {servings !== 1 ? 's' : ''}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#073B3A',
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#E2FD52',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  tabStrip: {
    paddingBottom: 12,
    paddingRight: 8,
    gap: 8,
  },
  recipeTab: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  recipeTabActive: {
    backgroundColor: '#073B3A',
    borderColor: '#073B3A',
  },
  recipeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  recipeTabTextActive: {
    color: '#E2FD52',
  },
  recipeCard: {
    backgroundColor: '#073B3A',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  recipeCardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recipeCardUnit: {
    fontSize: 12,
    color: 'rgba(226,253,82,0.7)',
    marginTop: 2,
  },
  priceTag: {
    backgroundColor: 'rgba(226,253,82,0.15)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,253,82,0.3)',
  },
  priceTagText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E2FD52',
    fontVariant: ['tabular-nums'],
  },
  priceTagLabel: {
    fontSize: 9,
    color: 'rgba(226,253,82,0.6)',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(226,253,82,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  ingredientsSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ingredientDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(226,253,82,0.5)',
    marginRight: 8,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ingredientQtyBase: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  ingredientTotalQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2FD52',
    fontVariant: ['tabular-nums'],
  },
  portionSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  portionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  portionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(226,253,82,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,253,82,0.4)',
  },
  portionBtnDisabled: {
    opacity: 0.3,
  },
  portionCountContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  portionCount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#E2FD52',
    fontVariant: ['tabular-nums'],
  },
  portionCountLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: -2,
  },
  deductionPreview: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  deductionPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  deductionPreviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2FD52',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  costValue: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(226,253,82,0.8)',
    fontVariant: ['tabular-nums'],
  },
  costValueBig: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E2FD52',
    fontVariant: ['tabular-nums'],
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  successBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },
  applyErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  applyErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },
  applyBtn: {
    backgroundColor: '#E2FD52',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  applyBtnDisabled: {
    opacity: 0.6,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#073B3A',
  },
});

export { RecipeModal };
