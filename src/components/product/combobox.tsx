import { useState, forwardRef, useImperativeHandle } from 'react'
import { Category } from '@/servers/backoffice/types/Category'

type SelectComponentProps = {
  categories: Category[] | undefined
  onChange?: (categoryId: string, subcategoryId: string) => void
  defaultCategoryId?: string
  defaultSubcategoryId?: string
}

export type SelectComponentRef = {
  getSelected: () => { categoryId: string; subcategoryId: string }
  resetCombos: () => void
}

const Combobox = forwardRef<SelectComponentRef, SelectComponentProps>(
  (
    { categories, onChange, defaultCategoryId = '', defaultSubcategoryId = '' },
    ref,
  ) => {
    const [selectedCategory, setSelectedCategory] =
      useState<string>(defaultCategoryId)
    const [selectedSubcategory, setSelectedSubcategory] =
      useState<string>(defaultSubcategoryId)

    // Encontra as subcategorias da categoria selecionada
    const subcategories =
      categories?.find((cat) => cat.categoryId === selectedCategory)
        ?.subcategories || []

    useImperativeHandle(ref, () => ({
      getSelected: () => ({
        categoryId: selectedCategory,
        subcategoryId: selectedSubcategory,
      }),
      resetCombos: () => {
        setSelectedCategory('')
        setSelectedSubcategory('')
      },
    }))

    function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
      const catId = e.target.value
      setSelectedCategory(catId)
      setSelectedSubcategory('')
      onChange?.(catId, '') // Atualiza no pai
    }

    function handleSubcategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
      const subId = e.target.value
      setSelectedSubcategory(subId)
      onChange?.(selectedCategory, subId) // Atualiza no pai
    }

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor="categoryName"
          className="text-sm font-medium text-gray-700"
        >
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          value={selectedCategory}
          onChange={handleCategoryChange}
          className="block w-full rounded-md border border-gray-300 bg-white p-2 shadow-sm focus:ring focus:ring-blue-500 focus:outline-none"
        >
          <option value="">Selecione uma categoria</option>
          {categories?.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.name}
            </option>
          ))}
        </select>

        {subcategories.length > 0 && (
          <>
            <label
              htmlFor="subcategoryName"
              className="text-sm font-medium text-gray-700"
            >
              Subcategory
            </label>
            <select
              id="subcategoryId"
              name="subcategoryId"
              value={selectedSubcategory}
              onChange={handleSubcategoryChange}
              className="block w-full rounded-md border border-gray-300 bg-white p-2 shadow-sm focus:ring focus:ring-blue-500 focus:outline-none"
              disabled={!selectedCategory}
            >
              <option value="">Selecione uma subcategoria</option>
              {subcategories?.map((subcategory) => (
                <option
                  key={subcategory.subcategoryId}
                  value={subcategory.subcategoryId}
                >
                  {subcategory.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    )
  },
)

Combobox.displayName = 'Combobox'

export default Combobox
