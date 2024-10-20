// import { Fragment, useState, useRef } from 'react'
// import useSWR, { useSWRConfig } from 'swr'
// import useSWRMutation from 'swr/mutation'

// const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

// function Profile({ token }) {
//   const [isModalOpen, setIsModalOpen] = useState(false)
//   const [editing, setEditing] = useState(false)
//   const [data, setData] = useState([])
//   const modalRef = useRef(null)
//   const [errorMessage, setErrorMessage] = useState(null)

//   const urlSWR = `${BASE_URL}/users`
//   const headers = {
//     'Content-Type': 'application/json',
//     Authorization: `Bearer ${token}`,
//   }

//   const fetcher = async (url) => {
//     const res = await fetch(url, {
//       headers,
//     })
//     if (!res.ok) {
//       const errorData = await res.json()
//       const error = new Error('An error occurred while fetching the data.')
//       error.info = errorData
//       error.status = res.status
//       throw error
//     }
//     return res.json()
//   }

//   const { data, isLoading } = useSWR(urlSWR, fetcher)

//   const { mutate } = useSWRConfig()

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     if (modalRef.current && !modalRef.current.contains(e.target)) {
//       closeModal()
//     }

//     try {
//       await triggerHandleSubmit({ arg: currentRule })
//     } catch (error) {
//       console.error('Erro ao adicionar/editar regra:', error)
//     }
//   }

//   const { trigger: triggerHandleSubmit } = useSWRMutation(
//     urlSWR,
//     async (url, { arg: permissionId }) => {
//       const response = await fetch(`${url}/${permissionId.arg}`, {
//         method: 'DELETE',
//         headers,
//       })
//       if (!response.ok) {
//         const errorData = await response.json()
//         const errorMessage = errorData.error || 'An unexpected error occurred'
//         setErrorMessage(errorMessage) // Captura a mensagem de erro
//         return { error: errorMessage } // Retorna um objeto de erro
//       }
//       return response
//     },
//     {
//       onSuccess: async (data) => {
//         if (data.error) {
//           console.log('Erro detectado: ', data.error)
//           return // Não prossegue se houver um erro
//         }
//         setErrorMessage(null) // Limpa a mensagem de erro em caso de sucesso
//         await mutate(urlSWR)
//       },
//       onError: (error) => {
//         setErrorMessage(error.message) // Captura a mensagem de erro
//       },
//     },
//   )

//   const openModal = () => {
//     setIsModalOpen(true)
//   }

//   const closeModal = () => {
//     setIsModalOpen(false)
//   }

//   const handleClickOutside = (event) => {}

//   if (isLoading) return <div>Loading...</div>

//   return (
//     <Fragment>
//       <form
//         onSubmit={handleSubmit}
//         className="bg-white p-6 rounded-lg shadow-lg w-full"
//       >
//         <h2 className="text-2xl font-bold mb-4">Perfil</h2>
//         <div className="mb-4">
//           <label className="block text-sm font-medium text-gray-700">
//             Nome
//           </label>
//           <input
//             type="text"
//             value=""
//             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
//             disabled
//           />
//         </div>
//         <div className="mb-4">
//           <label className="block text-sm font-medium text-gray-700">
//             Email
//           </label>
//           <input
//             type="email"
//             value=""
//             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
//             disabled
//           />
//         </div>
//         <button type="submit">Editar</button>
//         <button
//           onClick={openModal}
//           className="w-full bg-green-500 text-white py-2 rounded mt-4"
//         >
//           Mudar password
//         </button>
//         <button className="w-full bg-blue-500 text-white py-2 rounded mt-4">
//           Logout
//         </button>

//         {isModalOpen && (
//           <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
//             <div
//               ref={modalRef}
//               className="bg-white p-6 rounded-lg shadow-lg w-96"
//             >
//               <h2 className="text-xl font-bold mb-4">Mudar password</h2>
//               <div className="mb-4">
//                 <label className="block text-gray-700">Atual Password</label>
//                 <input
//                   type="password"
//                   className="w-full p-2 border border-gray-300 rounded mt-1"
//                 />
//               </div>
//               <div className="mb-4">
//                 <label className="block text-gray-700">Nova Password</label>
//                 <input
//                   type="password"
//                   className="w-full p-2 border border-gray-300 rounded mt-1"
//                 />
//               </div>
//               <div className="mb-4">
//                 <label className="block text-gray-700">
//                   Confirm New Password
//                 </label>
//                 <input
//                   type="password"
//                   className="w-full p-2 border border-gray-300 rounded mt-1"
//                 />
//               </div>
//               <button className="w-full bg-blue-500 text-white py-2 rounded mt-4">
//                 Update Password
//               </button>
//               <button
//                 onClick={closeModal}
//                 className="w-full bg-gray-300 text-gray-700 py-2 rounded mt-2"
//               >
//                 Cancel
//               </button>
//             </div>
//           </div>
//         )}
//       </form>
//     </Fragment>
//   )
// }

// export default Profile
